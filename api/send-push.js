import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

let initError = null;

// Initialize Firebase Admin (Singleton)
if (!admin.apps.length) {
    try {
        let key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is missing');

        // Sanitize: Remove wrapping quotes if present (common copy-paste error)
        key = key.trim();
        if (key.startsWith('"') && key.endsWith('"')) {
            key = key.slice(1, -1);
        }
        // Handle escaped newlines if they were pasted literally
        key = key.replace(/\\n/g, '\n');

        const serviceAccount = JSON.parse(key);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Firebase Admin Init Error:', error);
        initError = error;
    }
}

export default async function handler(request, response) {
    if (initError) {
        return response.status(500).json({ error: 'Firebase Init Failed: ' + initError.message });
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, title, body } = request.body;

    if (!userId || !title || !body) {
        return response.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        // Accept both detailed service role key or fallback to standard key configs
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY;

        console.log('--- DEBUG: api/send-push.js ---');
        console.log('VITE_SUPABASE_URL exists:', !!supabaseUrl);
        console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
        console.log('Resulting supabaseKey exists:', !!supabaseKey);

        const supabase = createClient(supabaseUrl, supabaseKey);

        // --- BROADCAST LOGIC ---
        if (userId === 'ALL') {
            const { data: users, error } = await supabase
                .from('users')
                .select('fcm_token')
                .not('fcm_token', 'is', null);

            if (error) throw error;

            const tokens = users.map(u => u.fcm_token).filter(t => t && t.length > 10);

            if (tokens.length === 0) {
                return response.status(200).json({ message: 'No registered devices found.' });
            }

            const messages = tokens.map(token => ({
                notification: { title, body },
                token
            }));

            if (messages.length > 0) {
                const batchResponse = await admin.messaging().sendEach(messages);
                return response.status(200).json({
                    success: true,
                    successCount: batchResponse.successCount,
                    failureCount: batchResponse.failureCount
                });
            } else {
                return response.status(200).json({ message: 'No valid tokens found.' });
            }
        }
        // -----------------------

        const { data: user, error } = await supabase
            .from('users')
            .select('fcm_token')
            .eq('id', userId)
            .single();

        if (error || !user || !user.fcm_token) {
            console.log('User has no token or error', error);
            return response.status(200).json({ message: 'User skipped (no token)' });
        }

        const message = {
            notification: {
                title: title,
                body: body
            },
            token: user.fcm_token
        };

        const result = await admin.messaging().send(message);
        return response.status(200).json({ success: true, messageId: result });

    } catch (error) {
        console.error('Push Error:', error);
        return response.status(500).json({ error: error.message });
    }
}
