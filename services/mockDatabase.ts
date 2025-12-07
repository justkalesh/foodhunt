
import { User, Vendor, Review, MealSplit, GenericResponse, MenuItem, Message, Conversation, SplitRequest } from '../types';
import { supabase } from './supabase';

// --- Helper Functions ---
// Supabase returns { data, error }. We map this to our GenericResponse.

const getRateLimitSlot = () => {
  const now = new Date();
  const hour = now.getHours();
  // 0-3, 3-6, 6-9, 9-12, 12-15, 15-18, 18-21, 21-24
  // Returns integer 0-7
  return Math.floor(hour / 3);
};


const recalculateVendorStats = async (vendorId: string) => {
  const { data: items } = await supabase.from('menu_items').select('*').eq('vendor_id', vendorId).eq('is_active', true);

  if (!items || items.length === 0) {
    await supabase.from('vendors').update({
      lowest_item_price: 0,
      avg_price_per_meal: 0,
      recommended_item_name: null,
      recommended_item_price: null
    }).eq('id', vendorId);
    return;
  }

  const prices = items.map((i: any) => i.price);
  const lowest = Math.min(...prices);
  const avg = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length);

  const recommended = items.find((i: any) => i.is_recommended);

  await supabase.from('vendors').update({
    lowest_item_price: lowest,
    avg_price_per_meal: avg,
    recommended_item_name: recommended?.name || null,
    recommended_item_price: recommended?.price || null
  }).eq('id', vendorId);
};

export const api = {
  // USERS ENDPOINTS
  users: {
    getMe: async (userId: string): Promise<GenericResponse<User>> => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;
        if (data) return { success: true, message: 'Fetched user.', data: data as User };
        return { success: false, message: 'User not found.' };
      } catch (error: any) {
        return { success: false, message: error.message || 'Error fetching user' };
      }
    },
    updateProfile: async (userId: string, updates: Partial<User>): Promise<GenericResponse<User>> => {
      try {
        const { id, email, role, ...safeUpdates } = updates;
        const { data, error } = await supabase
          .from('users')
          .update({ ...safeUpdates, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        return { success: true, message: 'Profile updated.', data: data as User };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    getActivity: async (userId: string) => {
      try {
        // Recent Reviews
        const { data: reviews, error: reviewError } = await supabase
          .from('reviews')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (reviewError) throw reviewError;

        // Recent Splits (joined)
        // 'people_joined_ids' is an array.
        const { data: splits, error: splitError } = await supabase
          .from('meal_splits')
          .select('*')
          .contains('people_joined_ids', [userId])
          .order('created_at', { ascending: false })
          .limit(5);

        if (splitError) throw splitError;

        return {
          success: true,
          message: 'Activity fetched',
          data: {
            recentReviews: reviews || [],
            recentSplits: (splits || []).slice(0, 3)
          }
        };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    search: async (queryText: string): Promise<GenericResponse<User>> => {
      try {
        // Search by ID or Email
        // Try ID first if it looks like a uuid (skip for now, just text search)
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .or(`id.eq.${queryText},email.eq.${queryText}`)
          .maybeSingle();

        if (error) throw error;
        if (data) return { success: true, message: 'User found.', data: data as User };

        return { success: false, message: 'User not found.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
  },

  // VENDOR ENDPOINTS
  vendors: {
    getAll: async (): Promise<GenericResponse<Vendor[]>> => {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .order('is_featured', { ascending: false })
          .order('sort_order', { ascending: true });
        if (error) throw error;
        return { success: true, message: 'Fetched vendors.', data: data as Vendor[] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    getById: async (id: string): Promise<GenericResponse<Vendor>> => {
      try {
        const { data, error } = await supabase.from('vendors').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return { success: true, message: 'Fetched vendor.', data: data as Vendor };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    getReviews: async (vendorId: string): Promise<GenericResponse<Review[]>> => {
      try {
        // Fetch reviews AND user names ideally. 
        // For now, raw fetch.
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, message: 'Fetched reviews.', data: data as Review[] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    addReview: async (vendorId: string, userId: string, rating: number, text: string): Promise<GenericResponse<Review>> => {
      try {
        const newReview = {
          user_id: userId,
          vendor_id: vendorId,
          rating,
          review_text: text,
          created_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('reviews').insert(newReview).select().single();
        if (error) throw error;

        // Award Loyalty Points using RPC or client-side update
        // Client side for now to match logic:
        const { data: user } = await supabase.from('users').select('loyalty_points').eq('id', userId).single();
        if (user) {
          await supabase.from('users').update({ loyalty_points: (user.loyalty_points || 0) + 5 }).eq('id', userId);
        }

        return { success: true, message: 'Review posted. +5 Loyalty Points!', data: data as Review };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    getMenuItems: async (vendorId: string): Promise<GenericResponse<MenuItem[]>> => {
      try {
        const { data, error } = await supabase.from('menu_items').select('*').eq('vendor_id', vendorId).order('name', { ascending: true });
        if (error) throw error;
        return { success: true, message: 'Fetched menu items.', data: data as MenuItem[] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    updateMenuItem: async (item: MenuItem): Promise<GenericResponse<MenuItem>> => {
      try {
        const { data, error } = await supabase.from('menu_items').update(item).eq('id', item.id).select().single();
        if (error) throw error;
        await recalculateVendorStats(item.vendor_id);
        return { success: true, message: 'Menu item updated.', data: data as MenuItem };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    setRecommendedItem: async (vendorId: string, itemId: string): Promise<GenericResponse<null>> => {
      try {
        // Reset all for this vendor
        await supabase.from('menu_items').update({ is_recommended: false }).eq('vendor_id', vendorId);

        // Set new one
        await supabase.from('menu_items').update({ is_recommended: true }).eq('id', itemId);

        await recalculateVendorStats(vendorId);
        return { success: true, message: 'Recommended item updated.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    addMenuItem: async (vendorId: string, name: string, price: number, category?: string): Promise<GenericResponse<MenuItem>> => {
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .insert({ vendor_id: vendorId, name, price, category, is_active: true })
          .select()
          .single();
        if (error) throw error;
        await recalculateVendorStats(vendorId);
        return { success: true, message: 'Menu item added.', data: data as MenuItem };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    deleteMenuItem: async (itemId: string): Promise<GenericResponse<null>> => {
      try {
        // Need vendorId to recalculate. Fetch first.
        const { data: item } = await supabase.from('menu_items').select('vendor_id').eq('id', itemId).single();

        const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
        if (error) throw error;

        if (item) await recalculateVendorStats(item.vendor_id);
        return { success: true, message: 'Menu item deleted.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    deleteReview: async (reviewId: string): Promise<GenericResponse<null>> => {
      try {
        const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
        if (error) throw error;
        return { success: true, message: 'Review deleted.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
  },

  // MEAL SPLITS
  splits: {
    getAll: async (userId?: string): Promise<GenericResponse<MealSplit[]>> => {
      try {
        // Fetch open splits
        const { data: openSplits, error: openError } = await supabase
          .from('meal_splits')
          .select('*')
          .eq('is_closed', false)
          .order('created_at', { ascending: false });

        if (openError) throw openError;

        let allSplits = openSplits as MealSplit[];

        // If user is logged in, fetch their closed splits ensuring we don't duplicate
        if (userId) {
          const { data: mySplits, error: myError } = await supabase
            .from('meal_splits')
            .select('*')
            .contains('people_joined_ids', [userId])
            .eq('is_closed', true)
            .order('created_at', { ascending: false });

          if (!myError && mySplits) {
            allSplits = [...allSplits, ...(mySplits as MealSplit[])];
          }
        }

        // Sort combined list by created_at desc
        allSplits.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return { success: true, message: 'Fetched splits.', data: allSplits };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    requestJoin: async (splitId: string, userId: string): Promise<GenericResponse<SplitRequest>> => {
      try {
        // 1. Rate Check
        const currentSlot = getRateLimitSlot();
        const now = new Date();
        const startOfSlot = new Date(now);
        startOfSlot.setHours(currentSlot * 3, 0, 0, 0);

        const { count, error: countError } = await supabase
          .from('split_join_requests')
          .select('*', { count: 'exact', head: true })
          .eq('requester_id', userId)
          .gte('created_at', startOfSlot.toISOString());

        if (countError) throw countError;

        if ((count || 0) >= 5) {
          return { success: false, message: 'Rate limit exceeded: You can only request 5 splits in this 3-hour slot.' };
        }

        // 2. Check if already joined or requested
        const { data: split } = await supabase.from('meal_splits').select('people_joined_ids, creator_id, dish_name, vendor_name, split_time').eq('id', splitId).single();
        if (!split) return { success: false, message: 'Split not found' };
        if (split.people_joined_ids.includes(userId)) return { success: false, message: 'You have already joined this split.' };

        // 3. Create Request
        const { data: request, error: reqError } = await supabase
          .from('split_join_requests')
          .insert({ split_id: splitId, requester_id: userId, status: 'pending' })
          .select()
          .single();

        if (reqError) {
          if (reqError.code === '23505') return { success: false, message: 'Request already sent.' }; // Unique constraint
          throw reqError;
        }

        // 4. Send Automated Message to Creator
        // We use the existing sendMessage logic but include request_id
        // Manually constructing it here to avoid circular dependencies or modifying the 'send' signature too much yet
        // Ideally refactor 'send' to take options. For now, let's call 'send' and then update it? 
        // Or better, just insert it here directly for atomicity/control.

        const splitTimeDate = new Date(split.split_time || new Date());
        const formattedTime = splitTimeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedDate = splitTimeDate.toLocaleDateString();

        const content = `Hii, I'd like to join your split of ${split.dish_name} from ${split.vendor_name} at ${formattedDate} ${formattedTime}.`;
        const chatId = [userId, split.creator_id].sort().join('_');

        // Ensure conversation exists (Reuse logic conceptually)
        // For simplicity, we assume generic 'messages.send' works, but we want to attach `request_id`.
        // Let's modify 'messages.send' or just do a raw insert here for the special system message.

        // Let's just use raw insert to attach request_id easily
        const { data: existingChat } = await supabase.from('conversations').select('id').eq('id', chatId).maybeSingle();
        if (!existingChat) {
          // Create Conversation Stub (Simplified)
          const { data: s } = await supabase.from('users').select('name,email').eq('id', userId).single();
          const { data: r } = await supabase.from('users').select('name,email').eq('id', split.creator_id).single();
          await supabase.from('conversations').insert({
            id: chatId,
            participants: [userId, split.creator_id],
            participant_details: { [userId]: s, [split.creator_id]: r },
            updated_at: new Date().toISOString()
          });
        }

        await supabase.from('messages').insert({
          conversation_id: chatId,
          sender_id: userId,
          receiver_id: split.creator_id,
          content: content,
          request_id: request.id
        });

        // Update conversation last_msessage
        await supabase.from('conversations').update({
          last_message: { content, sender_id: userId, created_at: new Date().toISOString(), is_read: false },
          updated_at: new Date().toISOString()
        }).eq('id', chatId);

        return { success: true, message: 'Request sent successfully!', data: request as SplitRequest };

      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    cancelRequest: async (requestId: string): Promise<GenericResponse<null>> => {
      try {
        const { error } = await supabase.from('split_join_requests').delete().eq('id', requestId);
        if (error) throw error;
        return { success: true, message: 'Request cancelled.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    respondToRequest: async (requestId: string, status: 'accepted' | 'rejected'): Promise<GenericResponse<null>> => {
      try {
        // Fetch request first
        const { data: req, error: fetchError } = await supabase.from('split_join_requests').select('*').eq('id', requestId).single();
        if (fetchError || !req) return { success: false, message: 'Request not found.' };

        if (status === 'rejected') {
          // Just update status
          await supabase.from('split_join_requests').update({ status: 'rejected' }).eq('id', requestId);
          return { success: true, message: 'Request rejected.' };
        }

        if (status === 'accepted') {
          // Add to split
          const { data: split } = await supabase.from('meal_splits').select('*').eq('id', req.split_id).single();
          if (!split) return { success: false, message: 'Split not found.' };

          if (split.people_joined_ids.includes(req.requester_id)) {
            // Already inside, just mark accepted
            await supabase.from('split_join_requests').update({ status: 'accepted' }).eq('id', requestId);
            return { success: true, message: 'Already joined.' };
          }

          const newPeople = [...split.people_joined_ids, req.requester_id];
          const isClosed = newPeople.length >= split.people_needed;

          const { error: updateError } = await supabase
            .from('meal_splits')
            .update({ people_joined_ids: newPeople, is_closed: isClosed })
            .eq('id', req.split_id);

          if (updateError) throw updateError;

          await supabase.from('split_join_requests').update({ status: 'accepted' }).eq('id', requestId);

          // Update user active split
          await supabase.from('users').update({ active_split_id: req.split_id }).eq('id', req.requester_id);

          return { success: true, message: 'Request accepted, user joined.' };
        }

        return { success: false, message: 'Invalid status' };

      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    // Get my pending requests (for UI status updates)
    getMyRequests: async (userId: string): Promise<GenericResponse<SplitRequest[]>> => {
      try {
        const { data, error } = await supabase.from('split_join_requests').select('*').eq('requester_id', userId);
        if (error) throw error;
        return { success: true, message: 'Fetched', data: data as SplitRequest[] };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    },

    create: async (splitData: any): Promise<GenericResponse<MealSplit>> => {
      try {
        // Time Conflict Check: +/- 4 hours
        // Fetch all active splits the user is part of
        const { data: userSplits, error: fetchError } = await supabase
          .from('meal_splits')
          .select('*')
          .contains('people_joined_ids', [splitData.creator_id])
          .eq('is_closed', false);

        if (fetchError) throw fetchError;

        const newTime = new Date(splitData.split_time).getTime();
        const FOUR_HOURS = 4 * 60 * 60 * 1000;

        const hasConflict = userSplits?.some(s => {
          if (!s.split_time) return false;
          const existingTime = new Date(s.split_time).getTime();
          return Math.abs(existingTime - newTime) < FOUR_HOURS;
        });

        if (hasConflict) {
          return { success: false, message: 'You have another split scheduled within 4 hours of this time.' };
        }

        const newSplit = {
          ...splitData,
          people_joined_ids: [splitData.creator_id],
          is_closed: false,
          created_at: new Date().toISOString()
        };

        const { data: split, error } = await supabase.from('meal_splits').insert(newSplit).select().single();
        if (error) throw error;

        // We no longer strictly enforce single active_split_id for blocking, 
        // but we can still update it for "current focus" if needed, or just ignore it.
        // Let's update it to the newest one for Profile page compatibility.
        await supabase.from('users').update({ active_split_id: split.id }).eq('id', splitData.creator_id);

        return { success: true, message: 'Split created.', data: split as MealSplit };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    join: async (splitId: string, userId: string): Promise<GenericResponse<MealSplit>> => {
      // Deprecated in favor of requestJoin, but kept for Fallback or Instant Join if we wanted
      return { success: false, message: 'Please use Request to Join.' };
    },

    leave: async (splitId: string, userId: string): Promise<GenericResponse<null>> => {
      try {
        // ALWAYS clear user active_split_id first to prevent "stuck" state
        await supabase.from('users').update({ active_split_id: null }).eq('id', userId);

        const { data: split, error: fetchError } = await supabase.from('meal_splits').select('*').eq('id', splitId).maybeSingle();

        // If split doesn't exist, we just return success since we cleaned up the user
        if (fetchError || !split) return { success: true, message: 'Left split (cleanup).' };

        const newPeople = split.people_joined_ids.filter((id: string) => id !== userId);

        // Requirements: 
        // 1. If no one left -> Delete split
        if (newPeople.length === 0) {
          await supabase.from('meal_splits').delete().eq('id', splitId);
          return { success: true, message: 'Left and split deleted (empty).' };
        }

        // 2. Ownership Transfer: If creator leaves, pass to next member
        let updates: any = { people_joined_ids: newPeople };
        if (split.creator_id === userId) {
          const newCreatorId = newPeople[0];
          const { data: newCreator } = await supabase.from('users').select('name').eq('id', newCreatorId).single();
          if (newCreator) {
            updates.creator_id = newCreatorId;
            updates.creator_name = newCreator.name;
          }
        }

        // Check is_closed
        const isClosed = newPeople.length >= split.people_needed;
        updates.is_closed = isClosed;

        await supabase
          .from('meal_splits')
          .update(updates)
          .eq('id', splitId);

        // INBOX CLEANUP: Delete chat between leaver and creator if they are different
        if (split.creator_id !== userId) {
          const chatId = [userId, split.creator_id].sort().join('_');
          await supabase.from('conversations').delete().eq('id', chatId);
        }

        return { success: true, message: 'Left split successfully.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    getById: async (splitId: string): Promise<GenericResponse<MealSplit>> => {
      try {
        const { data, error } = await supabase.from('meal_splits').select('*').eq('id', splitId).maybeSingle();
        if (error) throw error;
        return { success: true, message: 'Fetched split', data: data as MealSplit };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    delete: async (splitId: string): Promise<GenericResponse<null>> => {
      try {
        const { error } = await supabase.from('meal_splits').delete().eq('id', splitId);
        if (error) throw error;
        return { success: true, message: 'Split deleted successfully.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    markAsComplete: async (splitId: string): Promise<GenericResponse<MealSplit>> => {
      try {
        const { data, error } = await supabase
          .from('meal_splits')
          .update({ is_closed: true })
          .eq('id', splitId)
          .select()
          .single();

        if (error) throw error;
        return { success: true, message: 'Split marked as complete!', data: data as MealSplit };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
  },


  // MESSAGES ENDPOINTS (Refactored for Supabase)
  messages: {
    getInbox: async (userId: string): Promise<GenericResponse<Conversation[]>> => {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .contains('participants', [userId])
          .order('updated_at', { ascending: false });

        if (error) throw error;
        return { success: true, message: 'Inbox fetched', data: data as Conversation[] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    getChat: async (conversationId: string): Promise<GenericResponse<Message[]>> => {
      try {
        console.log(`[DEBUG] fetching chat for: ${conversationId}`);
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }); // Chronological

        if (error) {
          console.error('[DEBUG] Supabase error:', error);
          throw error;
        }
        console.log(`[DEBUG] fetched ${data?.length} messages`);

        // Fetch statuses for any request_ids
        const messages = data as Message[];
        const requestIds = messages.map(m => m.request_id).filter(Boolean) as string[];

        if (requestIds.length > 0) {
          const { data: reqs } = await supabase.from('split_join_requests').select('id, status').in('id', requestIds);
          const statusMap = (reqs || []).reduce((acc: any, curr: any) => {
            acc[curr.id] = curr.status;
            return acc;
          }, {});

          messages.forEach(m => {
            if (m.request_id) {
              m.request_status = statusMap[m.request_id] || 'pending'; // invalid id -> pending or error?
            }
          });
        }

        return { success: true, message: 'Chat fetched', data: messages };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    send: async (senderId: string, receiverId: string, content: string): Promise<GenericResponse<Message>> => {
      try {
        const chatId = [senderId, receiverId].sort().join('_');

        // 1. Get/Create Conversation
        let { data: chat } = await supabase.from('conversations').select('*').eq('id', chatId).single();

        const now = new Date().toISOString();

        if (!chat) {
          // Fetch names
          const { data: sender } = await supabase.from('users').select('name, email, pfp_url').eq('id', senderId).single();
          const { data: receiver } = await supabase.from('users').select('name, email, pfp_url').eq('id', receiverId).single();

          const newConv = {
            id: chatId,
            participants: [senderId, receiverId],
            participant_details: {
              [senderId]: sender || { name: 'Unknown' },
              [receiverId]: receiver || { name: 'Unknown' }
            },
            last_message: { content, sender_id: senderId, created_at: now, is_read: false },
            unread_counts: { [senderId]: 0, [receiverId]: 1 },
            updated_at: now
          };

          const { error: createError } = await supabase.from('conversations').insert(newConv);
          // If concurrent create, this fails, but we can ignore or retry. Simplified here.
        } else {
          // Update existng
          const unread = (chat.unread_counts?.[receiverId] || 0) + 1;
          const updatedCounts = { ...chat.unread_counts, [receiverId]: unread };

          await supabase.from('conversations').update({
            last_message: { content, sender_id: senderId, created_at: now, is_read: false },
            unread_counts: updatedCounts,
            updated_at: now
          }).eq('id', chatId);
        }

        // 2. Insert Message
        const newMessage = {
          conversation_id: chatId,
          sender_id: senderId,
          receiver_id: receiverId,
          content,
          is_read: false,
          created_at: now
        };

        const { data: msg, error: msgError } = await supabase.from('messages').insert(newMessage).select().single();
        if (msgError) throw msgError;

        return { success: true, message: 'Message sent.', data: msg as Message };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    markAsRead: async (conversationId: string, userId: string): Promise<GenericResponse<null>> => {
      try {
        // Fetch current to merge json
        const { data: chat } = await supabase.from('conversations').select('unread_counts').eq('id', conversationId).single();
        if (chat) {
          const newCounts = { ...chat.unread_counts, [userId]: 0 };
          await supabase.from('conversations').update({ unread_counts: newCounts }).eq('id', conversationId);
        }
        // Also update individual messages if we wanted strict read receipts
        return { success: true, message: 'Marked as read' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    deleteConversation: async (userId: string, conversationId: string): Promise<GenericResponse<null>> => {
      try {
        // Cascade delete should handle messages
        const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
        if (error) throw error;
        return { success: true, message: 'Conversation deleted.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    clearAll: async (userId: string): Promise<GenericResponse<null>> => {
      try {
        const { error } = await supabase.from('conversations').delete().contains('participants', [userId]);
        if (error) throw error;
        return { success: true, message: 'Inbox cleared.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
  },

  // ADMIN ENDPOINTS (Stubbed for now, Supabase has simpler counts)
  admin: {
    getStats: async (): Promise<GenericResponse<any>> => {
      const { count: u } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { count: v } = await supabase.from('vendors').select('*', { count: 'exact', head: true });
      const { count: r } = await supabase.from('reviews').select('*', { count: 'exact', head: true });
      return { success: true, message: 'Stats', data: { totalUsers: u, totalVendors: v, totalReviews: r } };
    },
    users: {
      getAll: async () => {
        const { data } = await supabase.from('users').select('*');
        return { success: true, message: 'Users', data: data as User[] };
      },
      toggleStatus: async (id: string) => {
        // Fetch first
        const { data } = await supabase.from('users').select('is_disabled').eq('id', id).single();
        if (data) {
          const { data: updated } = await supabase.from('users').update({ is_disabled: !data.is_disabled }).eq('id', id).select().single();
          return { success: true, message: 'Toggled', data: updated as User };
        }
        return { success: false, message: 'User not found' };
      },
      create: async () => ({ success: false, message: "Use signup" })
    },
    vendors: {
      create: async (data: any) => {
        const { data: v, error } = await supabase.from('vendors').insert(data).select().single();
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Created', data: v };
      },
      update: async (id: string, data: any) => {
        const { data: v, error } = await supabase.from('vendors').update(data).eq('id', id).select().single();
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Updated', data: v };
      },
      delete: async (id: string) => {
        await supabase.from('vendors').delete().eq('id', id);
        return { success: true, message: 'Deleted' };
      }
    }
  }
};
