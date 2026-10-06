import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface UseAnalyticsSessionProps {
  domain?: string;
  campaignSetupId?: string;
  templateId?: string;
}

export function useAnalyticsSession({ domain, campaignSetupId, templateId }: UseAnalyticsSessionProps) {
  const initialized = useRef(false);
  const sessionRef = useRef({
    visitorId: '',
    sessionId: '',
    durationSeconds: 0,
    lastActiveAt: Date.now(),
    isFinalized: false
  });
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  useEffect(() => {
    // Only initialize when we have the necessary context and haven't initialized yet
    if (initialized.current || !domain || !campaignSetupId || !templateId) {
      return;
    }

    initialized.current = true;

    const initSession = async () => {
      // 1. Get or create visitor ID
      let visitorId = localStorage.getItem('visitor_id');
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem('visitor_id', visitorId);
      }

      // 2. Create session ID
      const sessionId = crypto.randomUUID();

      sessionRef.current = {
        ...sessionRef.current,
        visitorId,
        sessionId,
        lastActiveAt: Date.now()
      };

      // Fetch location and IP
      let locationData = {};
      try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (res.ok) {
          const data = await res.json();
          locationData = {
            ip_address: data.ip,
            location: {
              city: data.city,
              region: data.region,
              country: data.country,
              latitude: data.latitude,
              longitude: data.longitude,
              timezone: data.timezone
            }
          };
        }
      } catch (err) {
        console.error('Failed to fetch location:', err);
      }

      // 3. Insert initial session record
      try {
        const nowIso = new Date().toISOString();
        const { error } = await supabase.from('analytics_sessions' as any).insert({
          session_id: sessionId,
          visitor_id: visitorId,
          domain,
          campaign_setup_id: campaignSetupId,
          template_id: templateId,
          started_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
          ...locationData
        });
        if (error && error.code !== '23505') { // Ignore unique constraint violations from strict mode remounts
          console.error('Failed to insert analytics session:', error);
        }
      } catch (err) {
        console.error('Error inserting analytics session:', err);
      }

      // 4. Join Realtime Presence
      const channel = supabase.channel(`campaign:${campaignSetupId}`, {
        config: { presence: { key: visitorId } }
      });
      channelRef.current = channel;

      channel.on('presence', { event: 'sync' }, () => {
        // Presence synced
      }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            visitor_id: visitorId,
            session_id: sessionId,
            domain,
            template_id: templateId,
            ...locationData
          });
        }
      });
      
      // 5. Connect to Global Analytics Presence for Online/Offline Tracking
      presenceChannelRef.current = supabase.channel('global:analytics_presence', {
        config: {
          presence: {
            key: sessionId
          }
        }
      });

      presenceChannelRef.current.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED' && presenceChannelRef.current) {
          await presenceChannelRef.current.track({
            online_at: new Date().toISOString(),
            campaign: campaignSetupId
          });
        }
      });
    };

    initSession();
  }, [domain, campaignSetupId, templateId]); // End of the initSession useEffect

  const actionQueue = useRef<any[]>([]);

  const flushActions = async () => {
    if (actionQueue.current.length === 0 || !sessionRef.current.sessionId) return;
    const toSend = [...actionQueue.current];
    actionQueue.current = []; // Clear queue immediately

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    if (SUPABASE_URL && SUPABASE_KEY) {
      const url = `${SUPABASE_URL}/rest/v1/rpc/append_campaign_actions`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_session_id: sessionRef.current.sessionId,
            p_new_actions: toSend
          })
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error('Failed to save actions:', res.status, errText);
          throw new Error('Failed to save actions');
        }
      } catch (error) {
        console.error('Action flush error:', error);
        // Re-queue on failure, put them at the front
        actionQueue.current = [...toSend, ...actionQueue.current];
      }
    }
  };

  // Set up periodic flush
  useEffect(() => {
    const interval = setInterval(flushActions, 5000);

    const handleBeforeUnload = () => flushActions();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushActions(); // Flush any remaining on unmount
    };
  }, []);

  useEffect(() => {
    // We only attach these listeners if initialization was triggered.
    if (!domain || !campaignSetupId || !templateId) return;

    const trackEvent = async (eventType: string, metadata: any) => {
      if (!sessionRef.current.sessionId) return;

      const action = {
        event_type: eventType,
        action_name: metadata.text || metadata.title || null,
        target_value: metadata.href || metadata.path || metadata.tag || null,
        product_name: metadata.productName || null,
        created_at: new Date().toISOString()
      };

      actionQueue.current.push(action);

      if (actionQueue.current.length >= 10) {
        flushActions(); // Flush immediately if queue gets too large
      }
    };

    // Track global clicks on buttons and links
    const handleGlobalClick = (e: MouseEvent) => {
      let el = e.target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') {
          const dataAction = el.getAttribute('data-action-name');
          const dataProduct = el.getAttribute('data-action-value');
          const actionText = dataAction || el.innerText?.trim() || el.getAttribute('aria-label') || el.id || 'Unknown';

          // Ignore rubbing the lamp, but allow Rub Again
          if (actionText.toLowerCase() === 'rub the magic lamp') {
            break;
          }

          const href = el.getAttribute('href');
          trackEvent('button_click', {
            text: actionText.substring(0, 100),
            tag: el.tagName.toLowerCase(),
            href,
            productName: dataProduct
          });
          break; // Stop at first clickable ancestor
        }
        el = el.parentElement;
      }
    };
    document.addEventListener('click', handleGlobalClick, { capture: true });

    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [domain, campaignSetupId, templateId]);
}



