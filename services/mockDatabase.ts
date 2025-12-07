
import { User, Vendor, Review, MealSplit, GenericResponse, MenuItem, Message, Conversation } from '../types';
import { supabase } from './supabase';

// --- Helper Functions ---
// Supabase returns { data, error }. We map this to our GenericResponse.

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
        const { data, error } = await supabase.from('menu_items').select('*').eq('vendor_id', vendorId);
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
        return { success: true, message: 'Menu item updated.', data: data as MenuItem };
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
      try {
        const { data: split, error: fetchError } = await supabase.from('meal_splits').select('*').eq('id', splitId).maybeSingle();
        if (fetchError || !split) return { success: false, message: 'Split not found' };

        if (split.people_joined_ids.includes(userId)) return { success: false, message: 'Already joined.' };

        // Time Conflict Check
        const { data: userSplits, error: userSplitsError } = await supabase
          .from('meal_splits')
          .select('*')
          .contains('people_joined_ids', [userId])
          .eq('is_closed', false);

        if (userSplitsError) throw userSplitsError;

        const newTime = new Date(split.split_time).getTime();
        const FOUR_HOURS = 4 * 60 * 60 * 1000;

        const hasConflict = userSplits?.some(s => {
          if (!s.split_time) return false;
          const existingTime = new Date(s.split_time).getTime();
          return Math.abs(existingTime - newTime) < FOUR_HOURS;
        });

        if (hasConflict) {
          return { success: false, message: 'You have another split scheduled within 4 hours of this time.' };
        }

        const newPeople = [...split.people_joined_ids, userId];
        const isClosed = newPeople.length >= split.people_needed;

        const { data: updatedSplit, error: updateError } = await supabase
          .from('meal_splits')
          .update({ people_joined_ids: newPeople, is_closed: isClosed })
          .eq('id', splitId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Update active split id for basic profile compat
        await supabase.from('users').update({ active_split_id: splitId }).eq('id', userId);

        return { success: true, message: 'Joined split!', data: updatedSplit as MealSplit };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
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
        return { success: true, message: 'Chat fetched', data: data as Message[] };
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
