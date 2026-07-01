# Real-time Chat Project Plan

## 1. Muc tieu project

Xay dung mot ung dung chat real-time de luyen fullstack va co so du lieu voi stack:

- Frontend: React + Vite
- Backend: Node.js + Express
- Real-time: Socket.IO
- Database: PostgreSQL
- Database access: SQL thuong bang thu vien `pg`
- Authentication: JWT + bcrypt
- Styling: Tailwind CSS

Muc tieu quan trong cua project nay la vua lam duoc san pham chat that, vua luyen PostgreSQL, quan he bang, JOIN, transaction, index va query toi uu.

## 2. Pham vi MVP

Ban dau nen lam cac chuc nang sau:

- Dang ky tai khoan
- Dang nhap tai khoan
- Xem danh sach user
- Tao cuoc tro chuyen 1-1
- Gui tin nhan real-time
- Nhan tin nhan real-time
- Luu lich su tin nhan vao PostgreSQL
- Xem danh sach cuoc tro chuyen
- Xem lich su tin nhan cua tung conversation
- Hien thi online/offline co ban
- Hien thi typing indicator co ban

Chua nen lam ngay:

- Upload file
- Call video/audio
- Ma hoa end-to-end
- Push notification
- Search nang cao
- Message reaction
- Reply/thread message

Nhung tinh nang nay co the them sau khi MVP chay on dinh.

## 3. Kien truc tong quan

```txt
React Client
  |
  | REST API
  | - auth
  | - users
  | - conversations
  | - message history
  |
  | Socket.IO
  | - send message
  | - receive message
  | - typing
  | - online/offline
  v
Express Server
  |
  | pg Pool
  v
PostgreSQL
```

REST API dung cho cac thao tac can lay du lieu on dinh:

- Dang ky
- Dang nhap
- Lay profile
- Lay danh sach user
- Lay danh sach conversation
- Lay lich su tin nhan

Socket.IO dung cho cac su kien real-time:

- User online
- User offline
- Join conversation room
- Gui tin nhan
- Nhan tin nhan
- Dang go tin nhan
- Da doc tin nhan

## 4. Cong nghe su dung

### Backend

- `express`: tao REST API
- `pg`: ket noi va query PostgreSQL bang SQL thuong
- `socket.io`: real-time communication
- `bcrypt`: hash password
- `jsonwebtoken`: tao va verify JWT
- `cors`: cho phep frontend goi API
- `dotenv`: quan ly bien moi truong
- `nodemon`: auto restart server luc dev

Lenh cai dat backend:

```bash
npm install express pg socket.io cors dotenv bcrypt jsonwebtoken
npm install -D nodemon
```

### Frontend

- `react`: xay UI
- `vite`: dev server nhanh
- `socket.io-client`: ket noi Socket.IO tu browser
- `axios`: goi REST API
- `react-router-dom`: routing
- `zustand`: quan ly state gon nhe
- `tailwindcss`: styling

Lenh cai dat frontend:

```bash
npm create vite@latest client -- --template react
cd client
npm install axios socket.io-client react-router-dom zustand
npm install -D tailwindcss
```

## 5. Cau truc thu muc de xuat

```txt
chat-app/
  server/
    src/
      app.js
      server.js
      db/
        pool.js
        migrations/
          001_create_extensions.sql
          002_create_users.sql
          003_create_conversations.sql
          004_create_conversation_members.sql
          005_create_messages.sql
          006_create_indexes.sql
      middleware/
        auth.middleware.js
        error.middleware.js
      modules/
        auth/
          auth.routes.js
          auth.controller.js
          auth.service.js
        users/
          users.routes.js
          users.controller.js
          users.service.js
        conversations/
          conversations.routes.js
          conversations.controller.js
          conversations.service.js
        messages/
          messages.routes.js
          messages.controller.js
          messages.service.js
      socket/
        index.js
        auth.socket.js
        chat.socket.js
      utils/
        jwt.js
        password.js
    package.json
    .env

  client/
    src/
      api/
        axios.js
        auth.api.js
        users.api.js
        conversations.api.js
        messages.api.js
      components/
        AppLayout.jsx
        Sidebar.jsx
        ConversationList.jsx
        ChatHeader.jsx
        ChatWindow.jsx
        MessageBubble.jsx
        MessageInput.jsx
        UserSearch.jsx
      hooks/
        useSocket.js
        useAuth.js
      pages/
        Login.jsx
        Register.jsx
        Chat.jsx
      routes/
        AppRoutes.jsx
        ProtectedRoute.jsx
      store/
        authStore.js
        chatStore.js
        socketStore.js
      main.jsx
    package.json
```

## 6. Database design

Project nay nen dung UUID lam primary key. Trong PostgreSQL, can bat extension:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Bang users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  status_message VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Bang conversations

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group')),
  name VARCHAR(100),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Bang conversation_members

Bang nay the hien quan he many-to-many giua users va conversations.

```sql
CREATE TABLE conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_read_message_id UUID,
  UNIQUE (conversation_id, user_id)
);
```

### Bang messages

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'file')),
  file_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### Foreign key bo sung cho last_read_message_id

```sql
ALTER TABLE conversation_members
ADD CONSTRAINT fk_last_read_message
FOREIGN KEY (last_read_message_id)
REFERENCES messages(id)
ON DELETE SET NULL;
```

## 7. Index can co

Index giup query nhanh hon khi du lieu nhieu.

```sql
CREATE INDEX idx_users_email
ON users(email);

CREATE INDEX idx_conversation_members_user_id
ON conversation_members(user_id);

CREATE INDEX idx_conversation_members_conversation_id
ON conversation_members(conversation_id);

CREATE INDEX idx_messages_conversation_created_at
ON messages(conversation_id, created_at DESC);

CREATE INDEX idx_messages_sender_id
ON messages(sender_id);
```

## 8. Query SQL quan trong can luyen

### Tim user theo email

```sql
SELECT id, name, email, password_hash
FROM users
WHERE email = $1;
```

### Lay conversations cua mot user

```sql
SELECT
  c.id,
  c.type,
  c.name,
  c.created_at,
  c.updated_at
FROM conversations c
JOIN conversation_members cm
  ON cm.conversation_id = c.id
WHERE cm.user_id = $1
ORDER BY c.updated_at DESC;
```

### Lay tin nhan cua mot conversation

```sql
SELECT
  m.id,
  m.content,
  m.type,
  m.file_url,
  m.created_at,
  u.id AS sender_id,
  u.name AS sender_name,
  u.avatar_url AS sender_avatar
FROM messages m
JOIN users u
  ON u.id = m.sender_id
WHERE m.conversation_id = $1
  AND m.deleted_at IS NULL
ORDER BY m.created_at DESC
LIMIT $2 OFFSET $3;
```

### Kiem tra user co thuoc conversation khong

```sql
SELECT 1
FROM conversation_members
WHERE conversation_id = $1
  AND user_id = $2;
```

### Tao message moi

```sql
INSERT INTO messages (conversation_id, sender_id, content, type)
VALUES ($1, $2, $3, 'text')
RETURNING id, conversation_id, sender_id, content, type, created_at;
```

## 9. Transaction can dung

### Tao conversation 1-1

Khi tao chat 1-1, nen dung transaction:

1. Kiem tra da co direct conversation giua 2 user chua.
2. Neu co thi tra ve conversation cu.
3. Neu chua co thi tao conversation moi.
4. Them 2 dong vao `conversation_members`.
5. Commit.

Pseudo-code:

```js
const client = await pool.connect();

try {
  await client.query("BEGIN");

  // 1. Check existing direct conversation
  // 2. Insert conversation
  // 3. Insert members

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

### Gui tin nhan

Khi user gui tin:

1. Kiem tra user co trong conversation khong.
2. Insert message.
3. Update `conversations.updated_at`.
4. Commit.
5. Emit message qua Socket.IO.

Khong nen chi emit socket ma khong luu database.

## 10. Backend API design

### Auth APIs

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

Register body:

```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "password": "123456"
}
```

Login body:

```json
{
  "email": "a@example.com",
  "password": "123456"
}
```

### User APIs

```txt
GET /api/users
GET /api/users/search?q=abc
GET /api/users/:id
```

### Conversation APIs

```txt
GET  /api/conversations
POST /api/conversations/direct
POST /api/conversations/group
GET  /api/conversations/:id
```

Create direct conversation body:

```json
{
  "targetUserId": "uuid"
}
```

Create group conversation body:

```json
{
  "name": "Team Project",
  "memberIds": ["uuid-1", "uuid-2"]
}
```

### Message APIs

```txt
GET   /api/conversations/:conversationId/messages
PATCH /api/conversations/:conversationId/read
DELETE /api/messages/:messageId
```

## 11. Socket.IO events

### Client emit len server

```txt
join_conversation
leave_conversation
send_message
typing_start
typing_stop
mark_as_read
```

### Server emit ve client

```txt
user_online
user_offline
receive_message
message_sent
message_error
typing_start
typing_stop
message_read
```

### Payload gui message

Client gui:

```json
{
  "conversationId": "uuid",
  "content": "Hello",
  "type": "text"
}
```

Server tra ve:

```json
{
  "id": "message-uuid",
  "conversationId": "conversation-uuid",
  "sender": {
    "id": "user-uuid",
    "name": "Nguyen Van A",
    "avatarUrl": null
  },
  "content": "Hello",
  "type": "text",
  "createdAt": "2026-06-30T14:00:00.000Z"
}
```

## 12. Luong dang nhap va socket

1. User login bang REST API.
2. Server tra ve JWT.
3. Frontend luu JWT.
4. Frontend connect Socket.IO kem token.
5. Backend verify token o socket middleware.
6. Neu token hop le, socket duoc gan `socket.user`.
7. Khi user vao conversation, client emit `join_conversation`.
8. Backend cho socket join room theo `conversationId`.

Vi du room:

```txt
conversation:550e8400-e29b-41d4-a716-446655440000
```

## 13. Frontend UI plan

### Trang Login

- Email input
- Password input
- Submit button
- Link sang Register
- Hien loi neu login sai

### Trang Register

- Name input
- Email input
- Password input
- Submit button
- Link sang Login

### Trang Chat

Layout:

```txt
-------------------------------------------------
| Sidebar conversations | Chat header            |
|                       |------------------------|
|                       | Message list           |
|                       |                        |
|                       |------------------------|
|                       | Message input          |
-------------------------------------------------
```

Sidebar:

- Current user info
- Search user
- Conversation list
- Last message preview
- Time of last message

Chat area:

- Chat header
- Message list
- Typing indicator
- Message input

Message bubble:

- Noi dung
- Thoi gian
- Sender name voi group chat
- Trang thai da gui/da doc neu muon mo rong

## 14. State management frontend

### authStore

Quan ly:

- `user`
- `token`
- `isAuthenticated`
- `login()`
- `register()`
- `logout()`

### chatStore

Quan ly:

- `conversations`
- `activeConversation`
- `messagesByConversation`
- `onlineUserIds`
- `typingUsers`
- `setActiveConversation()`
- `addMessage()`
- `loadMessages()`

### socketStore

Quan ly:

- `socket`
- `connectSocket()`
- `disconnectSocket()`
- `emitSendMessage()`
- `registerSocketListeners()`

## 15. Bao mat can co

- Hash password bang bcrypt, khong luu password plain text.
- JWT secret dat trong `.env`, khong hard-code.
- Moi API quan trong phai qua auth middleware.
- Truoc khi lay messages, backend phai check user co thuoc conversation khong.
- Truoc khi gui message, backend phai check user co thuoc conversation khong.
- Dung parameterized query `$1`, `$2` de tranh SQL injection.
- Khong tra `password_hash` ve frontend.
- Validate request body truoc khi query database.

## 16. Bien moi truong

Backend `.env`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/realtime_chat
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173
```

Frontend `.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## 17. Phase trien khai chi tiet

### Phase 1: Setup project

- Tao folder `server`
- Tao Express server
- Tao folder `client`
- Tao React app bang Vite
- Setup CORS
- Setup dotenv
- Setup PostgreSQL database local
- Tao `pool.js` dung thu vien `pg`

Ket qua can co:

- Backend chay o `http://localhost:5000`
- Frontend chay o `http://localhost:5173`
- Backend query duoc PostgreSQL

### Phase 2: Database migrations

- Tao extension `pgcrypto`
- Tao bang `users`
- Tao bang `conversations`
- Tao bang `conversation_members`
- Tao bang `messages`
- Tao indexes
- Test insert/select bang SQL

Ket qua can co:

- Database co day du bang
- Co the tao user test bang SQL
- Co the query JOIN co ban

### Phase 3: Authentication

- API register
- API login
- Hash password
- Generate JWT
- Middleware verify JWT
- Frontend login/register page
- Luu token sau khi login
- Protected route cho trang chat

Ket qua can co:

- User dang ky duoc
- User dang nhap duoc
- Refresh trang van biet user da login neu token con hop le

### Phase 4: Users va conversations

- API lay danh sach user
- API search user
- API tao direct conversation
- API lay danh sach conversations cua current user
- UI sidebar conversations
- UI search user de bat dau chat

Ket qua can co:

- User A co the tim User B
- User A co the tao chat 1-1 voi User B
- Conversation hien trong sidebar

### Phase 5: Message history

- API lay messages theo conversation
- Query messages voi JOIN users
- Pagination bang `LIMIT` va `OFFSET`
- UI hien message list
- Auto scroll xuong tin moi

Ket qua can co:

- Click vao conversation thi thay lich su tin nhan
- Tin nhan cu duoc lay tu PostgreSQL

### Phase 6: Socket.IO real-time

- Setup Socket.IO server
- Setup socket auth bang JWT
- Client connect socket sau khi login
- Join room theo conversation
- Emit `send_message`
- Backend insert message vao DB
- Backend emit `receive_message`
- Frontend update message list

Ket qua can co:

- Mo 2 browser voi 2 account khac nhau
- Gui tin o browser A thi browser B nhan ngay
- Refresh trang van thay lich su tin nhan

### Phase 7: Online status va typing

- Luu user online trong memory Map
- Emit `user_online`
- Emit `user_offline`
- Emit `typing_start`
- Emit `typing_stop`
- UI hien typing indicator

Ket qua can co:

- Biet user nao dang online
- Khi nguoi kia go tin, UI hien dang typing

### Phase 8: Read status

- Cap nhat `last_read_message_id`
- API mark conversation as read
- Socket event `mark_as_read`
- Emit `message_read`
- UI hien trang thai da doc co ban

Ket qua can co:

- Conversation biet user da doc den message nao
- Co the hien unread count trong sidebar

### Phase 9: Group chat

- Tao group conversation
- Them nhieu member vao group
- Role admin/member
- Hien sender name tren message
- Chi admin duoc them member neu muon mo rong

Ket qua can co:

- Nhieu user co the chat trong cung mot group
- Message duoc emit den tat ca member trong group

### Phase 10: Polish va deploy

- Responsive mobile
- Loading states
- Empty states
- Error messages
- Logout
- Avatar mac dinh
- Deploy frontend
- Deploy backend
- Deploy PostgreSQL

## 18. Thu tu code de it bi roi

Nen lam theo thu tu nay:

1. Tao database va tables
2. Tao Express server
3. Ket noi PostgreSQL bang `pg`
4. Lam register/login
5. Lam auth middleware
6. Lam React login/register
7. Lam API users
8. Lam API conversations
9. Lam API messages history
10. Lam UI chat layout
11. Setup Socket.IO
12. Gui/nhan tin real-time
13. Online/offline
14. Typing indicator
15. Read status
16. Group chat
17. Polish UI
18. Deploy

## 19. Nhung kien thuc CSDL se luyen duoc

Project nay giup luyen:

- Thiet ke schema
- Primary key
- Foreign key
- Unique constraint
- Check constraint
- Many-to-many relationship
- JOIN
- LEFT JOIN
- GROUP BY
- ORDER BY
- Pagination
- Index
- Transaction
- Rollback
- SQL injection prevention
- Query performance

Day la ly do khong dung Prisma se rat tot cho muc tieu hoc CSDL.

## 20. Checklist hoan thanh MVP

- [ ] Backend Express chay duoc
- [ ] PostgreSQL ket noi duoc
- [ ] Tao duoc tables bang SQL
- [ ] Register user duoc
- [ ] Login user duoc
- [ ] JWT auth hoat dong
- [ ] Frontend login/register hoat dong
- [ ] Lay danh sach user duoc
- [ ] Tao conversation 1-1 duoc
- [ ] Lay conversations cua user duoc
- [ ] Lay messages cua conversation duoc
- [ ] Socket.IO connect duoc
- [ ] User join conversation room duoc
- [ ] Gui tin nhan real-time duoc
- [ ] Tin nhan duoc luu vao database
- [ ] Refresh trang van thay tin nhan cu
- [ ] Hien online/offline co ban
- [ ] Hien typing indicator co ban

## 21. Goi y nang cap sau MVP

- Upload image message
- Upload file message
- Search message
- Edit message
- Delete message
- Reaction emoji
- Reply to message
- Pin conversation
- Mute conversation
- Unread count
- Push notification
- Admin dashboard
- Docker compose cho PostgreSQL va backend
- Unit test cho service
- Integration test cho API

## 22. Ket luan

Huong lam tot nhat cho project cua ban:

```txt
React + Express + PostgreSQL + pg + Socket.IO
```

Khong dung Prisma se giup ban hieu database sau hon, dac biet la:

- Cach thiet ke bang
- Cach noi bang bang foreign key
- Cach viet JOIN
- Cach dung transaction
- Cach tranh duplicate conversation
- Cach toi uu query bang index

Nen lam MVP nho truoc: login, chat 1-1, luu message, real-time. Sau khi phan nay chay tot, moi them group chat, read status, upload file va cac tinh nang nang cao.
