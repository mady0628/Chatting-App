import { useState } from 'react';
import { uploadFileAPI, updateGroupProfileAPI } from '../api/endpoints.js';
import useChatStore from '../store/chatStore.js';
import { useSocket } from '../hooks/useSocket.js';

const GroupProfileModal = ({ onClose }) => {
    const { activeConversation, updateGroupInfo } = useChatStore();
    const { socket } = useSocket();
    const [groupName, setGroupName] = useState(activeConversation?.group_name || '');
    const [avatarUrl, setAvatarUrl] = useState(activeConversation?.group_avatar || '');
    const [isUploading, setIsUploading] = useState(false);

    // Tải ảnh đại diện mới lên Cloudinary
    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const res = await uploadFileAPI(file);
            if (res.success) {
                setAvatarUrl(res.fileURL);
            }
        } catch (err) {
            alert("Lỗi khi tải ảnh nhóm!");
        } finally {
            setIsUploading(false);
        }
    };

    // Lưu thông tin nhóm
    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const res = await updateGroupProfileAPI({
                conversationID: activeConversation.id,
                name: groupName,
                avatar_url: avatarUrl
            });

            if (res.success) {
                // Cập nhật State Zustand ở máy mình
                updateGroupInfo(activeConversation.id, {
                    group_name: groupName,
                    group_avatar: avatarUrl
                });

                // Phát Socket thông báo cho các máy khác trong nhóm
                socket?.emit('update_group_profile', {
                    conversationID: activeConversation.id,
                    group_name: groupName,
                    group_avatar: avatarUrl
                });

                onClose();
            }
        } catch (err) {
            alert(err.response?.data?.message || "Lỗi khi cập nhật thông tin nhóm");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
                <h3 className="font-bold text-lg text-slate-900 mb-4">Chỉnh sửa hồ sơ nhóm</h3>

                <form onSubmit={handleSave} className="space-y-4">
                    {/* Chọn Avatar Nhóm */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-blue-200 bg-sky-100 flex items-center justify-center font-bold text-2xl text-slate-700 shadow-inner">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Group Avatar" className="w-full h-full object-cover" />
                            ) : (
                                groupName?.charAt(0).toUpperCase()
                            )}
                        </div>
                        <label className="text-xs font-bold text-blue-600 hover:underline cursor-pointer">
                            {isUploading ? 'Đang tải ảnh...' : 'Đổi ảnh đại diện'}
                            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" disabled={isUploading} />
                        </label>
                    </div>

                    {/* Nhập Tên Nhóm */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Tên nhóm</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Nhập tên nhóm mới..."
                            className="w-full px-4 py-2.5 rounded-2xl bg-sky-50 border border-sky-100 text-sm focus:outline-none focus:border-blue-500 font-medium text-slate-900"
                        />
                    </div>

                    {/* Nút hành động */}
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer">
                            Hủy
                        </button>
                        <button type="submit" disabled={isUploading} className="flex-1 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-md shadow-blue-200/50">
                            Lưu thay đổi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GroupProfileModal;
