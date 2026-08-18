import { create } from 'zustand';

const useFriendStore = create((set) => ({
    friends: [],
    friendRequests: [],

    setFriends: (friends) => set({ friends: Array.isArray(friends) ? friends : [] }),
    setFriendRequests: (requests) => set({ friendRequests: Array.isArray(requests) ? requests : [] }),

    addFriend: (friend) => set((state) => {
        const exist = state.friends.some(f => String(f.friend_id) === String(friend.friend_id));
        if (exist) return state;
        return { friends: [...state.friends, friend] };
    }),

    removeFriend: (friendID) => set((state) => ({
        friends: state.friends.filter(f => String(f.friend_id) !== String(friendID))
    })),

    addFriendRequest: (request) => set((state) => {
        const exist = state.friendRequests.some(r => String(r.request_id) === String(request.request_id));
        if (exist) return state;
        return { friendRequests: [request, ...state.friendRequests] };
    }),

    removeFriendRequest: (requestID) => set((state) => ({
        friendRequests: state.friendRequests.filter(r => String(r.request_id) !== String(requestID))
    }))
}));

export default useFriendStore;
