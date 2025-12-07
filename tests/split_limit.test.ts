
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../services/mockDatabase';

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
// const mockEq = vi.fn(); // Unused in this scope
// const mockGte = vi.fn(); // Unused in this scope
const mockSingle = vi.fn();
// const mockMaybeSingle = vi.fn(); // Unused in this scope

vi.mock('../services/supabase', () => ({
    supabase: {
        from: (table: string) => {
            if (table === 'split_join_requests') {
                return {
                    select: mockSelect,
                    insert: mockInsert,
                    update: mockUpdate,
                };
            }
            if (table === 'meal_splits') {
                return {
                    select: () => ({ eq: () => ({ single: mockSingle }) }),
                };
            }
            // Catch-all for other tables (conversations, messages, etc used in requestJoin)
            return {
                select: () => ({ eq: () => ({ single: () => ({ data: {} }), maybeSingle: () => ({ data: {} }) }) }),
                insert: () => ({ select: () => ({ single: () => ({ data: { id: 'msg_123' }, error: null }) }) }),
                update: () => ({ eq: () => ({}) })
            };
        },
    },
}));


describe('Split Request Rate Limiting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow request if under limit', async () => {
        // Mock Count < 5
        // api.splits.requestJoin calls: from('split_join_requests').select(...).eq(...).gte(...)
        mockSelect.mockReturnValue({
            eq: () => ({
                gte: () => ({ count: 4, error: null })
            })
        });

        // Mock Split Exists
        mockSingle.mockReturnValue({ data: { people_joined_ids: [], creator_id: 'creator_1', dish_name: 'Pizza' } });

        // Mock Insert Success
        mockInsert.mockReturnValue({
            select: () => ({
                single: () => ({ data: { id: 'req_123', status: 'pending' }, error: null })
            })
        });

        const res = await api.splits.requestJoin('split_1', 'user_1');
        expect(res.success).toBe(true);
        expect(res.message).toContain('Request sent');
    });

    it('should block request if limit reached (5)', async () => {
        // Mock Count >= 5
        mockSelect.mockReturnValue({
            eq: () => ({
                gte: () => ({ count: 5, error: null })
            })
        });

        const res = await api.splits.requestJoin('split_1', 'user_1');
        expect(res.success).toBe(false);
        expect(res.message).toContain('Rate limit exceeded');
    });
});
