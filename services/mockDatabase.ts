
import { User, Vendor, Review, MealSplit, GenericResponse, MenuItem, Message, Conversation, SplitRequest, SplitParticipant } from '../types';
import { supabase } from './supabase';
import { sanitizeReviewText, sanitizeMessageContent, sanitizeDishName, sanitizeName, sanitizeString, INPUT_LIMITS } from '../utils/sanitize';

// --- Helper Functions ---
// Supabase returns { data, error }. We map this to our GenericResponse.

const getRateLimitSlot = () => {
  const now = new Date();
  const hour = now.getHours();
  // 0-3, 3-6, 6-9, 9-12, 12-15, 15-18, 18-21, 21-24
  // Returns integer 0-7
  return Math.floor(hour / 3);
};

// Helper to get participant user IDs from split_participants
const getParticipantIds = async (splitId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('split_participants')
    .select('user_id')
    .eq('split_id', splitId)
    .eq('status', 'joined');
  return (data || []).map(p => p.user_id);
};

// Helper to check if user is participant
const isUserParticipant = async (splitId: string, userId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('split_participants')
    .select('id')
    .eq('split_id', splitId)
    .eq('user_id', userId)
    .eq('status', 'joined')
    .maybeSingle();
  return !!data;
};

// Helper to get participant count
const getParticipantCount = async (splitId: string): Promise<number> => {
  const { count } = await supabase
    .from('split_participants')
    .select('*', { count: 'exact', head: true })
    .eq('split_id', splitId)
    .eq('status', 'joined');
  return count || 0;
};

// Helper to enrich splits with participant data
const enrichSplitsWithParticipants = async (splits: any[]): Promise<MealSplit[]> => {
  const enriched = await Promise.all(splits.map(async (split) => {
    const { data: participants } = await supabase
      .from('split_participants')
      .select('id, split_id, user_id, joined_at, status')
      .eq('split_id', split.id)
      .eq('status', 'joined');

    return {
      ...split,
      participants: (participants || []) as SplitParticipant[],
      participants_count: (participants || []).length
    } as MealSplit;
  }));
  return enriched;
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

  // Helper to get effective price from any available field
  const getEffectivePrice = (item: any): number => {
    // If regular price is set and > 0, use it
    if (item.price && item.price > 0) return item.price;

    // Otherwise check S/M/L prices and return the lowest available
    const sizePrices = [item.small_price, item.medium_price, item.large_price, item.xl_price]
      .filter((p): p is number => p != null && p > 0);

    if (sizePrices.length > 0) return Math.min(...sizePrices);

    return 0;
  };

  // Get all valid prices (filter out zeros)
  const prices = items.map(getEffectivePrice).filter((p: number) => p > 0);

  if (prices.length === 0) {
    await supabase.from('vendors').update({
      lowest_item_price: 0,
      avg_price_per_meal: 0,
      recommended_item_name: null,
      recommended_item_price: null
    }).eq('id', vendorId);
    return;
  }

  const lowest = Math.min(...prices);
  const avg = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length);

  const recommended = items.find((i: any) => i.is_recommended);
  const recommendedPrice = recommended ? getEffectivePrice(recommended) : null;

  await supabase.from('vendors').update({
    lowest_item_price: lowest,
    avg_price_per_meal: avg,
    recommended_item_name: recommended?.name || null,
    recommended_item_price: recommendedPrice
  }).eq('id', vendorId);
};

/**
 * Calculates a dynamic popularity score for a vendor based on engagement metrics.
 * 
 * Formula: Popularity = (RatingScore × 40%) + (EngagementScore × 60%)
 * - RatingScore: (rating_avg / 5) × 100 (normalized from 0-100)
 * - EngagementScore: min(100, (review_count × 5) + (split_count × 10))
 * 
 * @param vendorId - The vendor's UUID
 * @param ratingAvg - The vendor's average rating (0-5)
 * @param ratingCount - The vendor's total review count
 * @returns A popularity score from 0-100
 */
const calculatePopularity = async (vendorId: string, ratingAvg: number, ratingCount: number): Promise<number> => {
  // RatingScore: Normalize rating (0-5) to a 0-100 scale
  const ratingScore = (ratingAvg / 5) * 100;

  // EngagementScore: Count meal splits for this vendor
  const { count: splitCount } = await supabase
    .from('meal_splits')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_id', vendorId);

  // Reviews worth 5 points each, splits worth 10 points each, capped at 100
  const engagementScore = Math.min(100, (ratingCount * 5) + ((splitCount || 0) * 10));

  // Final popularity: 40% rating + 60% engagement
  const popularity = Math.round((ratingScore * 0.4) + (engagementScore * 0.6));

  return Math.min(100, Math.max(0, popularity)); // Clamp to 0-100
};

/**
 * Syncs rating_avg and rating_count for ALL vendors based on actual reviews.
 * Use this to fix vendors with existing reviews that weren't synced.
 */
export const syncAllVendorRatings = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Get all vendors
    const { data: vendors, error: vendorError } = await supabase.from('vendors').select('id');
    if (vendorError) throw vendorError;

    for (const vendor of vendors || []) {
      // Recalculate menu item stats (lowest/avg prices) - handles S/M/L pricing
      await recalculateVendorStats(vendor.id);

      // Get all reviews for this vendor
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('vendor_id', vendor.id);

      if (reviews && reviews.length > 0) {
        const totalRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0);
        const avgRating = parseFloat((totalRating / reviews.length).toFixed(1));
        await supabase.from('vendors').update({
          rating_avg: avgRating,
          rating_count: reviews.length
        }).eq('id', vendor.id);
      } else {
        // No reviews, ensure it's set to 0
        await supabase.from('vendors').update({
          rating_avg: 0,
          rating_count: 0
        }).eq('id', vendor.id);
      }
    }

    return { success: true, message: `Synced ratings & prices for ${vendors?.length || 0} vendors.` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
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

        // Fetch vendor names for reviews
        const reviewData = reviews || [];
        if (reviewData.length > 0) {
          const { data: vendors } = await supabase
            .from('vendors')
            .select('id, name')
            .in('id', reviewData.map((r: any) => r.vendor_id));

          if (vendors) {
            const vMap = vendors.reduce((acc: any, v: any) => ({ ...acc, [v.id]: v.name }), {});
            reviewData.forEach((r: any) => {
              r.vendor_name = vMap[r.vendor_id] || 'Unknown Vendor';
            });
          }
        }

        // Recent Splits (user is participant) - using split_participants table
        const { data: participations } = await supabase
          .from('split_participants')
          .select('split_id')
          .eq('user_id', userId)
          .eq('status', 'joined');

        const splitIds = (participations || []).map(p => p.split_id);
        let splits: any[] = [];

        if (splitIds.length > 0) {
          const { data: splitsData } = await supabase
            .from('meal_splits')
            .select('*')
            .in('id', splitIds)
            .order('created_at', { ascending: false })
            .limit(5);

          splits = splitsData || [];
        }

        return {
          success: true,
          message: 'Activity fetched',
          data: {
            recentReviews: reviewData,
            recentSplits: splits.slice(0, 3)
          }
        };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    search: async (queryText: string): Promise<GenericResponse<User>> => {
      try {
        // Search by UID, Email, or ID - use exact match first, then fallback to partial
        const trimmedQuery = queryText.trim().toLowerCase();

        // Try UID match first (fastest for 6-digit IDs)
        if (/^\d{6}$/.test(trimmedQuery)) {
          const { data: uidMatch, error: uidError } = await supabase
            .from('users')
            .select('*')
            .eq('uid', trimmedQuery)
            .maybeSingle();

          if (uidError && !uidError.message.includes('multiple')) throw uidError;
          if (uidMatch) return { success: true, message: 'User found.', data: uidMatch as User };
        }

        // Try exact email match
        const { data: exactMatch, error: exactError } = await supabase
          .from('users')
          .select('*')
          .ilike('email', trimmedQuery)
          .maybeSingle();

        if (exactError && !exactError.message.includes('multiple')) throw exactError;
        if (exactMatch) return { success: true, message: 'User found.', data: exactMatch as User };

        // Try exact ID match
        const { data: idMatch, error: idError } = await supabase
          .from('users')
          .select('*')
          .eq('id', trimmedQuery)
          .maybeSingle();

        if (idError) throw idError;
        if (idMatch) return { success: true, message: 'User found.', data: idMatch as User };

        // Try partial email match with wildcard
        const { data: partialMatch, error: partialError } = await supabase
          .from('users')
          .select('*')
          .ilike('email', `%${trimmedQuery}%`)
          .limit(1)
          .maybeSingle();

        if (partialError && !partialError.message.includes('multiple')) throw partialError;
        if (partialMatch) return { success: true, message: 'User found.', data: partialMatch as User };

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

        // Calculate dynamic popularity for each vendor
        const vendorsWithPopularity = await Promise.all(
          (data || []).map(async (vendor: any) => {
            const popularity = await calculatePopularity(
              vendor.id,
              vendor.rating_avg || 0,
              vendor.rating_count || 0
            );
            return { ...vendor, popularity_score: popularity } as Vendor;
          })
        );

        return { success: true, message: 'Fetched vendors.', data: vendorsWithPopularity };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    getById: async (id: string): Promise<GenericResponse<Vendor>> => {
      try {
        const { data, error } = await supabase.from('vendors').select('*').eq('id', id).maybeSingle();
        if (error) throw error;

        if (data) {
          // Calculate dynamic popularity
          const popularity = await calculatePopularity(
            data.id,
            data.rating_avg || 0,
            data.rating_count || 0
          );
          return { success: true, message: 'Fetched vendor.', data: { ...data, popularity_score: popularity } as Vendor };
        }

        return { success: false, message: 'Vendor not found.' };
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
        // Sanitize input
        const sanitizedText = sanitizeReviewText(text);
        if (!sanitizedText || sanitizedText.length < 3) {
          return { success: false, message: 'Review text must be at least 3 characters.' };
        }

        const newReview = {
          user_id: userId,
          vendor_id: vendorId,
          rating: Math.min(5, Math.max(1, rating)), // Clamp rating 1-5
          review_text: sanitizedText,
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

        // Recalculate vendor's rating_avg and rating_count
        const { data: allReviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('vendor_id', vendorId);

        if (allReviews && allReviews.length > 0) {
          const totalRating = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
          const newAvg = parseFloat((totalRating / allReviews.length).toFixed(1));
          await supabase.from('vendors').update({
            rating_avg: newAvg,
            rating_count: allReviews.length
          }).eq('id', vendorId);
        }

        return { success: true, message: 'Review posted. +5 Loyalty Points!', data: data as Review };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    getMenuItems: async (vendorId: string): Promise<GenericResponse<MenuItem[]>> => {
      try {
        const { data, error } = await supabase.from('menu_items').select('*').eq('vendor_id', vendorId).order('category', { ascending: true, nullsFirst: false }).order('name', { ascending: true });
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
        // Check current status
        const { data: current } = await supabase.from('menu_items').select('is_recommended').eq('id', itemId).single();

        if (current?.is_recommended) {
          // Currently true, so toggle to OFF
          await supabase.from('menu_items').update({ is_recommended: false }).eq('id', itemId);
        } else {
          // Currently false, so toggle ON (and clear others)
          await supabase.from('menu_items').update({ is_recommended: false }).eq('vendor_id', vendorId);
          await supabase.from('menu_items').update({ is_recommended: true }).eq('id', itemId);
        }

        await recalculateVendorStats(vendorId);
        return { success: true, message: 'Recommended item updated.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    addMenuItem: async (
      vendorId: string,
      name: string,
      price: number,
      category?: string,
      sizePrices?: { small_price?: number; medium_price?: number; large_price?: number; xl_price?: number }
    ): Promise<GenericResponse<MenuItem>> => {
      try {
        const insertData: any = { vendor_id: vendorId, name, price, category, is_active: true };
        if (sizePrices?.small_price !== undefined) insertData.small_price = sizePrices.small_price;
        if (sizePrices?.medium_price !== undefined) insertData.medium_price = sizePrices.medium_price;
        if (sizePrices?.large_price !== undefined) insertData.large_price = sizePrices.large_price;
        if (sizePrices?.xl_price !== undefined) insertData.xl_price = sizePrices.xl_price;

        const { data, error } = await supabase
          .from('menu_items')
          .insert(insertData)
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
        // Get vendor_id before deleting
        const { data: review } = await supabase.from('reviews').select('vendor_id').eq('id', reviewId).single();

        const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
        if (error) throw error;

        // Recalculate vendor's rating_avg and rating_count
        if (review?.vendor_id) {
          const { data: allReviews } = await supabase
            .from('reviews')
            .select('rating')
            .eq('vendor_id', review.vendor_id);

          if (allReviews && allReviews.length > 0) {
            const totalRating = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
            const newAvg = parseFloat((totalRating / allReviews.length).toFixed(1));
            await supabase.from('vendors').update({
              rating_avg: newAvg,
              rating_count: allReviews.length
            }).eq('id', review.vendor_id);
          } else {
            // No reviews left, reset to 0
            await supabase.from('vendors').update({
              rating_avg: 0,
              rating_count: 0
            }).eq('id', review.vendor_id);
          }
        }

        return { success: true, message: 'Review deleted.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
  },

  // GLOBAL MENU FETCHER (Context for AI)
  menus: {
    getAll: async (): Promise<GenericResponse<MenuItem[]>> => {
      try {
        const { data, error } = await supabase.from('menu_items').select('*').eq('is_active', true);
        if (error) throw error;
        return { success: true, message: 'Fetched all menus.', data: data as MenuItem[] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
  },

  // GLOBAL REVIEWS FETCHER (Context for AI)
  reviews: {
    getRecent: async (limit: number = 20): Promise<GenericResponse<Review[]>> => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return { success: true, message: 'Fetched recent reviews.', data: data as Review[] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
  },

  // MEAL SPLITS - REFACTORED TO USE split_participants TABLE
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

        let allSplitIds = (openSplits || []).map(s => s.id);

        // If user is logged in, also fetch their closed splits via split_participants
        if (userId) {
          const { data: myParticipations } = await supabase
            .from('split_participants')
            .select('split_id')
            .eq('user_id', userId)
            .eq('status', 'joined');

          const myClosedSplitIds = (myParticipations || []).map(p => p.split_id);

          // Fetch closed splits where user is participant
          if (myClosedSplitIds.length > 0) {
            const { data: mySplits } = await supabase
              .from('meal_splits')
              .select('*')
              .in('id', myClosedSplitIds)
              .eq('is_closed', true)
              .order('created_at', { ascending: false });

            // Merge without duplicates
            const mergedSplits = [...(openSplits || [])];
            for (const split of (mySplits || [])) {
              if (!allSplitIds.includes(split.id)) {
                mergedSplits.push(split);
                allSplitIds.push(split.id);
              }
            }

            // Enrich with participants and sort
            const enriched = await enrichSplitsWithParticipants(mergedSplits);
            enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return { success: true, message: 'Fetched splits.', data: enriched };
          }
        }

        // Enrich open splits with participants
        const enriched = await enrichSplitsWithParticipants(openSplits || []);
        enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return { success: true, message: 'Fetched splits.', data: enriched };
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

        // 2. Check if already joined via split_participants
        const { data: split } = await supabase.from('meal_splits').select('creator_id, dish_name, vendor_name, split_time').eq('id', splitId).single();
        if (!split) return { success: false, message: 'Split not found' };

        const alreadyJoined = await isUserParticipant(splitId, userId);
        if (alreadyJoined) return { success: false, message: 'You have already joined this split.' };

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
        const splitTimeDate = new Date(split.split_time || new Date());
        const formattedTime = splitTimeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedDate = splitTimeDate.toLocaleDateString();

        const content = `Hii, I'd like to join your split of ${split.dish_name} from ${split.vendor_name} at ${formattedDate} ${formattedTime}.`;
        const chatId = [userId, split.creator_id].sort().join('_');

        const { data: existingChat } = await supabase.from('conversations').select('id').eq('id', chatId).maybeSingle();
        if (!existingChat) {
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

        // Update conversation last_message
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
        // 1. Get request info if needed
        const { data: request } = await supabase.from('split_join_requests').select('*').eq('id', requestId).single();

        let conversationId = null;

        if (request) {
          // 2. Find the automated message (This likely holds the FK constraint preventing request deletion)
          const { data: message } = await supabase.from('messages').select('id, conversation_id').eq('request_id', requestId).single();

          if (message) {
            conversationId = message.conversation_id;
            // 3. Delete the message FIRST
            await supabase.from('messages').delete().eq('id', message.id);
          }
        }

        // 4. Delete Request (Now safe if FK was the issue)
        const { error } = await supabase.from('split_join_requests').delete().eq('id', requestId);
        if (error) throw error;

        // 5. Check if conversation is empty and clean up
        if (conversationId) {
          const { count, data: remainingMessages } = await supabase
            .from('messages')
            .select('*', { count: 'exact' })
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(1);

          if (count === 0 || !remainingMessages || remainingMessages.length === 0) {
            await supabase.from('conversations').delete().eq('id', conversationId);
          } else {
            // Conversation not empty, update last_message to the new latest one
            const newLastMsg = remainingMessages[0];
            await supabase.from('conversations').update({
              last_message: {
                content: newLastMsg.content,
                sender_id: newLastMsg.sender_id,
                created_at: newLastMsg.created_at,
                is_read: newLastMsg.is_read
              },
              updated_at: newLastMsg.created_at
            }).eq('id', conversationId);
          }
        }

        return { success: true, message: 'Request cancelled.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    respondToRequest: async (requestId: string, status: 'accepted' | 'rejected'): Promise<GenericResponse<null>> => {
      try {
        const { data: req, error: fetchError } = await supabase.from('split_join_requests').select('*').eq('id', requestId).single();
        if (fetchError || !req) return { success: false, message: 'Request not found.' };

        if (status === 'rejected') {
          await supabase.from('split_join_requests').update({ status: 'rejected' }).eq('id', requestId);
          return { success: true, message: 'Request rejected.' };
        }

        if (status === 'accepted') {
          const { data: split } = await supabase.from('meal_splits').select('*').eq('id', req.split_id).single();
          if (!split) return { success: false, message: 'Split not found.' };

          // Check if already joined via split_participants
          const alreadyJoined = await isUserParticipant(req.split_id, req.requester_id);
          if (alreadyJoined) {
            await supabase.from('split_join_requests').update({ status: 'accepted' }).eq('id', requestId);
            return { success: true, message: 'Already joined.' };
          }

          // Add user to split_participants
          const { error: insertError } = await supabase.from('split_participants').insert({
            split_id: req.split_id,
            user_id: req.requester_id,
            status: 'joined'
          });

          if (insertError && insertError.code !== '23505') throw insertError; // Ignore duplicate key

          // Check if split is now full
          const participantCount = await getParticipantCount(req.split_id);
          const isClosed = participantCount >= split.people_needed;

          if (isClosed) {
            await supabase.from('meal_splits').update({ is_closed: true }).eq('id', req.split_id);
          }

          await supabase.from('split_join_requests').update({ status: 'accepted' }).eq('id', requestId);
          await supabase.from('users').update({ active_split_id: req.split_id }).eq('id', req.requester_id);

          return { success: true, message: 'Request accepted, user joined.' };
        }

        return { success: false, message: 'Invalid status' };

      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

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
        // Sanitize inputs
        const sanitizedDishName = sanitizeDishName(splitData.dish_name);
        const sanitizedCreatorName = sanitizeName(splitData.creator_name);
        const sanitizedVendorName = sanitizeName(splitData.vendor_name);
        const sanitizedTimeNote = sanitizeString(splitData.time_note)?.slice(0, INPUT_LIMITS.timeNote);

        if (!sanitizedDishName || sanitizedDishName.length < 2) {
          return { success: false, message: 'Dish name must be at least 2 characters.' };
        }

        // Check for conflicting splits using split_participants
        const { data: myParticipations } = await supabase
          .from('split_participants')
          .select('split_id')
          .eq('user_id', splitData.creator_id)
          .eq('status', 'joined');

        const mySplitIds = (myParticipations || []).map(p => p.split_id);

        if (mySplitIds.length > 0) {
          const { data: userSplits } = await supabase
            .from('meal_splits')
            .select('*')
            .in('id', mySplitIds)
            .eq('is_closed', false);

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
        }

        const newSplit = {
          creator_id: splitData.creator_id,
          creator_name: sanitizedCreatorName,
          vendor_id: splitData.vendor_id,
          vendor_name: sanitizedVendorName,
          dish_name: sanitizedDishName,
          total_price: splitData.total_price,
          people_needed: splitData.people_needed,
          time_note: sanitizedTimeNote,
          split_time: splitData.split_time,
          is_closed: false,
          created_at: new Date().toISOString()
        };

        const { data: split, error } = await supabase.from('meal_splits').insert(newSplit).select().single();
        if (error) throw error;

        // Add creator as first participant
        await supabase.from('split_participants').insert({
          split_id: split.id,
          user_id: splitData.creator_id,
          status: 'joined'
        });

        await supabase.from('users').update({ active_split_id: split.id }).eq('id', splitData.creator_id);

        // Return with participants
        const enriched = await enrichSplitsWithParticipants([split]);
        return { success: true, message: 'Split created.', data: enriched[0] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    join: async (splitId: string, userId: string): Promise<GenericResponse<MealSplit>> => {
      return { success: false, message: 'Please use Request to Join.' };
    },

    leave: async (splitId: string, userId: string): Promise<GenericResponse<null>> => {
      try {
        await supabase.from('users').update({ active_split_id: null }).eq('id', userId);

        const { data: split, error: fetchError } = await supabase.from('meal_splits').select('*').eq('id', splitId).maybeSingle();

        if (fetchError || !split) return { success: true, message: 'Left split (cleanup).' };

        // Remove user from split_participants
        await supabase.from('split_participants')
          .update({ status: 'left' })
          .eq('split_id', splitId)
          .eq('user_id', userId);

        // Get remaining participants
        const participantIds = await getParticipantIds(splitId);

        if (participantIds.length === 0) {
          // No participants left, close the split
          await supabase.from('meal_splits').update({ is_closed: true }).eq('id', splitId);
          return { success: true, message: 'Left and split deleted (empty).' };
        }

        // Transfer ownership if creator left
        if (split.creator_id === userId) {
          const newCreatorId = participantIds[0];
          const { data: newCreator } = await supabase.from('users').select('name').eq('id', newCreatorId).single();
          if (newCreator) {
            await supabase.from('meal_splits').update({
              creator_id: newCreatorId,
              creator_name: newCreator.name
            }).eq('id', splitId);
          }
        }

        // Check if split should be closed (full)
        const isClosed = participantIds.length >= split.people_needed;
        if (isClosed) {
          await supabase.from('meal_splits').update({ is_closed: true }).eq('id', splitId);
        }

        // Clean up conversation if user was not creator
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
        if (!data) return { success: false, message: 'Split not found' };

        const enriched = await enrichSplitsWithParticipants([data]);
        return { success: true, message: 'Fetched split', data: enriched[0] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    delete: async (splitId: string): Promise<GenericResponse<null>> => {
      try {
        // Soft Delete logic (Archive) to bypass Foreign Key constraints
        const { error } = await supabase.from('meal_splits').update({
          is_closed: true,
        }).eq('id', splitId);

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
        const enriched = await enrichSplitsWithParticipants([data]);
        return { success: true, message: 'Split marked as complete!', data: enriched[0] };
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
        return { success: true, message: 'Fetched inbox.', data: data as Conversation[] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    getConversation: async (conversationId: string): Promise<GenericResponse<Message[]>> => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        return { success: true, message: 'Fetched messages.', data: data as Message[] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    sendMessage: async (conversationId: string, senderId: string, receiverId: string, content: string): Promise<GenericResponse<Message>> => {
      try {
        const sanitizedContent = sanitizeMessageContent(content);
        if (!sanitizedContent) {
          return { success: false, message: 'Message cannot be empty.' };
        }

        const newMessage = {
          conversation_id: conversationId,
          sender_id: senderId,
          receiver_id: receiverId,
          content: sanitizedContent,
          is_read: false,
          created_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('messages').insert(newMessage).select().single();
        if (error) throw error;

        // Update conversation last_message
        await supabase.from('conversations').update({
          last_message: {
            content: sanitizedContent,
            sender_id: senderId,
            created_at: new Date().toISOString(),
            is_read: false
          },
          updated_at: new Date().toISOString()
        }).eq('id', conversationId);

        return { success: true, message: 'Message sent.', data: data as Message };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    markAsRead: async (conversationId: string, userId: string): Promise<GenericResponse<null>> => {
      try {
        // Mark all messages as read where receiver is current user
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .eq('receiver_id', userId);

        // Update conversation last_message is_read if applicable
        const { data: conv } = await supabase.from('conversations').select('last_message').eq('id', conversationId).single();
        if (conv?.last_message && conv.last_message.sender_id !== userId) {
          await supabase.from('conversations').update({
            last_message: { ...conv.last_message, is_read: true }
          }).eq('id', conversationId);
        }

        return { success: true, message: 'Marked as read.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    getOrCreateConversation: async (userId: string, otherUserId: string): Promise<GenericResponse<Conversation>> => {
      try {
        const chatId = [userId, otherUserId].sort().join('_');

        // Check if exists
        const { data: existing } = await supabase.from('conversations').select('*').eq('id', chatId).maybeSingle();
        if (existing) return { success: true, message: 'Found.', data: existing as Conversation };

        // Create new
        const { data: userA } = await supabase.from('users').select('name, email, pfp_url').eq('id', userId).single();
        const { data: userB } = await supabase.from('users').select('name, email, pfp_url').eq('id', otherUserId).single();

        const newConv = {
          id: chatId,
          participants: [userId, otherUserId],
          participant_details: {
            [userId]: userA,
            [otherUserId]: userB
          },
          last_message: null,
          unread_counts: { [userId]: 0, [otherUserId]: 0 },
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('conversations').insert(newConv).select().single();
        if (error) throw error;

        return { success: true, message: 'Created.', data: data as Conversation };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    // Simplified send that creates/gets conversation automatically (used by AuthContext, Inbox)
    send: async (senderId: string, receiverId: string, content: string): Promise<GenericResponse<Message>> => {
      try {
        // Get or create conversation
        const convRes = await api.messages.getOrCreateConversation(senderId, receiverId);
        if (!convRes.success || !convRes.data) return { success: false, message: 'Failed to get/create conversation' };

        // Send message
        return api.messages.sendMessage(convRes.data.id, senderId, receiverId, content);
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    // Alias for getConversation (used by Inbox)
    getChat: async (conversationId: string): Promise<GenericResponse<Message[]>> => {
      return api.messages.getConversation(conversationId);
    },

    deleteConversation: async (conversationId: string, userId?: string): Promise<GenericResponse<null>> => {
      try {
        // Delete all messages first
        await supabase.from('messages').delete().eq('conversation_id', conversationId);
        // Delete conversation
        const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
        if (error) throw error;
        return { success: true, message: 'Conversation deleted.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    clearAll: async (userId: string): Promise<GenericResponse<null>> => {
      try {
        // Get all conversations for user
        const { data: convs } = await supabase
          .from('conversations')
          .select('id')
          .contains('participants', [userId]);

        if (convs) {
          for (const conv of convs) {
            await supabase.from('messages').delete().eq('conversation_id', conv.id);
            await supabase.from('conversations').delete().eq('id', conv.id);
          }
        }
        return { success: true, message: 'All conversations cleared.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
  },

  // ADMIN ENDPOINTS
  admin: {
    getAllUsers: async (): Promise<GenericResponse<User[]>> => {
      try {
        const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, message: 'Fetched users.', data: data as User[] };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    toggleUserDisabled: async (userId: string, isDisabled: boolean): Promise<GenericResponse<User>> => {
      try {
        const { data, error } = await supabase.from('users').update({ is_disabled: isDisabled }).eq('id', userId).select().single();
        if (error) throw error;
        return { success: true, message: `User ${isDisabled ? 'disabled' : 'enabled'}.`, data: data as User };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    updateUserRole: async (userId: string, role: string): Promise<GenericResponse<User>> => {
      try {
        const { data, error } = await supabase.from('users').update({ role }).eq('id', userId).select().single();
        if (error) throw error;
        return { success: true, message: `User role updated to ${role}.`, data: data as User };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    createVendor: async (vendorData: Partial<Vendor>): Promise<GenericResponse<Vendor>> => {
      try {
        const { data, error } = await supabase.from('vendors').insert(vendorData).select().single();
        if (error) throw error;
        return { success: true, message: 'Vendor created.', data: data as Vendor };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    updateVendor: async (vendorId: string, updates: Partial<Vendor>): Promise<GenericResponse<Vendor>> => {
      try {
        const { data, error } = await supabase.from('vendors').update(updates).eq('id', vendorId).select().single();
        if (error) throw error;
        return { success: true, message: 'Vendor updated.', data: data as Vendor };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },
    deleteVendor: async (vendorId: string): Promise<GenericResponse<null>> => {
      try {
        const { error } = await supabase.from('vendors').delete().eq('id', vendorId);
        if (error) throw error;
        return { success: true, message: 'Vendor deleted.' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    // Additional admin methods used by AdminDashboard, AdminUsers, AdminVendors
    getStats: async (): Promise<GenericResponse<{ users: number; vendors: number; splits: number; reviews: number }>> => {
      try {
        const [users, vendors, splits, reviews] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('vendors').select('*', { count: 'exact', head: true }),
          supabase.from('meal_splits').select('*', { count: 'exact', head: true }),
          supabase.from('reviews').select('*', { count: 'exact', head: true })
        ]);
        return {
          success: true,
          message: 'Stats fetched.',
          data: {
            users: users.count || 0,
            vendors: vendors.count || 0,
            splits: splits.count || 0,
            reviews: reviews.count || 0
          }
        };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    },

    // Users namespace for AdminUsers page
    users: {
      getAll: async (): Promise<GenericResponse<User[]>> => {
        try {
          const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
          if (error) throw error;
          return { success: true, message: 'Fetched users.', data: data as User[] };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
      update: async (userId: string, updates: Partial<User>): Promise<GenericResponse<User>> => {
        try {
          const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
          if (error) throw error;
          return { success: true, message: 'User updated.', data: data as User };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
      delete: async (userId: string): Promise<GenericResponse<null>> => {
        try {
          const { error } = await supabase.from('users').delete().eq('id', userId);
          if (error) throw error;
          return { success: true, message: 'User deleted.' };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
      toggleStatus: async (userId: string): Promise<GenericResponse<User>> => {
        try {
          // First get current status
          const { data: current } = await supabase.from('users').select('is_disabled').eq('id', userId).single();
          const newStatus = !(current?.is_disabled);
          const { data, error } = await supabase.from('users').update({ is_disabled: newStatus }).eq('id', userId).select().single();
          if (error) throw error;
          return { success: true, message: `User ${newStatus ? 'disabled' : 'enabled'}.`, data: data as User };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
      rewardPoints: async (userIds: string[], amount: number): Promise<GenericResponse<null>> => {
        try {
          for (const userId of userIds) {
            const { data: user } = await supabase.from('users').select('loyalty_points').eq('id', userId).single();
            const newPoints = (user?.loyalty_points || 0) + amount;
            await supabase.from('users').update({ loyalty_points: newPoints }).eq('id', userId);
          }
          return { success: true, message: `Rewarded ${userIds.length} user(s) with ${amount} points.` };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
      create: async (userData: { email: string; name: string; semester: string; password: string; role: string }): Promise<GenericResponse<User>> => {
        try {
          // Create auth user first
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: userData.email,
            password: userData.password,
            email_confirm: true
          });
          if (authError) throw authError;
          if (!authData.user) throw new Error('Failed to create auth user');

          // Create profile
          const newProfile = {
            id: authData.user.id,
            email: userData.email,
            name: userData.name,
            semester: userData.semester,
            role: userData.role,
            is_disabled: false,
            created_at: new Date().toISOString(),
            loyalty_points: 0
          };
          const { data, error } = await supabase.from('users').insert(newProfile).select().single();
          if (error) throw error;
          return { success: true, message: 'User created.', data: data as User };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      }
    },

    // Vendors namespace for AdminVendors page
    vendors: {
      getAll: async (): Promise<GenericResponse<Vendor[]>> => {
        try {
          const { data, error } = await supabase.from('vendors').select('*').order('sort_order', { ascending: true });
          if (error) throw error;
          return { success: true, message: 'Fetched vendors.', data: data as Vendor[] };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
      create: async (vendor: Partial<Vendor>): Promise<GenericResponse<Vendor>> => {
        try {
          const { data, error } = await supabase.from('vendors').insert(vendor).select().single();
          if (error) throw error;
          return { success: true, message: 'Vendor created.', data: data as Vendor };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
      update: async (vendorId: string, updates: Partial<Vendor>): Promise<GenericResponse<Vendor>> => {
        try {
          const { data, error } = await supabase.from('vendors').update(updates).eq('id', vendorId).select().single();
          if (error) throw error;
          return { success: true, message: 'Vendor updated.', data: data as Vendor };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
      delete: async (vendorId: string): Promise<GenericResponse<null>> => {
        try {
          const { error } = await supabase.from('vendors').delete().eq('id', vendorId);
          if (error) throw error;
          return { success: true, message: 'Vendor deleted.' };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      }
    }
  }
};
