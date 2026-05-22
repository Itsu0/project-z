

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline'

export interface User {
  id: string
  username: string
  displayName: string
  avatar?: string
  avatarColor?: string
  status: UserStatus
  customStatus?: string
  discriminator: string
}

export interface Role {
  id: string
  serverId: string
  name: string
  color: string
  permissions: Permission[]
  position: number
  hoist: boolean
  mentionable: boolean
}

export type Permission =
  | 'ADMINISTRATOR'
  | 'MANAGE_SERVER'
  | 'MANAGE_CHANNELS'
  | 'MANAGE_ROLES'
  | 'MANAGE_MESSAGES'
  | 'KICK_MEMBERS'
  | 'BAN_MEMBERS'
  | 'SEND_MESSAGES'
  | 'READ_MESSAGES'
  | 'CONNECT'
  | 'SPEAK'
  | 'MUTE_MEMBERS'
  | 'DEAFEN_MEMBERS'
  | 'MOVE_MEMBERS'
  | 'MENTION_EVERYONE'
  | 'USE_EMOJI'
  | 'UPLOAD_FILES'

export interface ServerMember {
  userId: string
  user: User
  serverId: string
  roles: Role[]
  nickname?: string
  joinedAt: string
  boosting?: boolean
}

export interface Server {
  id: string
  name: string
  icon?: string
  iconColor?: string
  description?: string
  ownerId: string
  memberCount: number
  onlineCount: number
  channels: Channel[]
  roles: Role[]
  emoji: CustomEmoji[]
  createdAt: string

  plan: 'free' | 'standard' | 'pro'
  expiresAt?: string
}

export type ChannelType = 'text' | 'voice' | 'announcement' | 'forum' | 'stage'

export interface Channel {
  id: string
  serverId: string
  type: ChannelType
  name: string
  topic?: string
  position: number
  categoryId?: string
  nsfw?: boolean
  slowmode?: number
  permissions?: ChannelPermissionOverride[]

  bitrate?: number
  userLimit?: number

  activeUsers?: VoiceUser[]
  unreadCount?: number
  mentionCount?: number
  lastMessageId?: string
  lastMessageAt?: string
}

export interface ChannelCategory {
  id: string
  serverId: string
  name: string
  position: number
  collapsed?: boolean
  channels: Channel[]
}

export interface ChannelPermissionOverride {
  targetId: string
  targetType: 'role' | 'user'
  allow: Permission[]
  deny: Permission[]
}

export type MessageType = 'DEFAULT' | 'SYSTEM' | 'BOT_EMBED' | 'POLL' | 'POLL_RESULT'

export interface Message {
  id: string
  channelId: string
  serverId: string
  author: User
  authorMember?: ServerMember
  content: string
  type: MessageType
  embeds?: Embed[]
  attachments?: Attachment[]
  reactions?: Reaction[]
  mentions?: User[]
  mentionRoles?: Role[]
  mentionEveryone?: boolean
  pinned?: boolean
  editedAt?: string
  replyTo?: { id: string; content: string; authorName: string } | null
  createdAt: string
  poll?: Poll | null

  pending?: boolean
  failed?: boolean
}

export interface Embed {
  id: string
  title?: string
  description?: string
  color?: string
  author?: { name: string; icon?: string }
  fields?: EmbedField[]
  footer?: string
  thumbnail?: string
  image?: string

  warEmbed?: WarEmbed
}

export interface EmbedField {
  name: string
  value: string
  inline?: boolean
}

export interface WarEmbed {
  warId: string
  dateTime: string
  opponent: string
  map: string
  currentPlayers: number
  maxPlayers: number
  reservePlayers: number
  progress: number
  userRegistered?: boolean
  userWeapon?: string
}

export interface Attachment {
  id: string
  filename: string
  url: string
  contentType: string
  size: number
  width?: number | null
  height?: number | null
}

export interface PollOption {
  id: string
  text: string
  votes: number
}

export interface Poll {
  id: string
  question: string
  multiChoice?: boolean
  expiresAt?: string | null
  closed?: boolean
  totalVotes: number
  userVotedOptionId?: string | null
  options: PollOption[]
}

export interface Reaction {
  emoji: string | CustomEmoji
  count: number
  userReacted: boolean
}

export interface VoiceUser {
  userId: string
  user: User
  muted: boolean
  deafened: boolean
  speaking: boolean
  cameraOn: boolean
  screenShare: boolean
}

export interface VoiceState {
  channelId: string | null
  channel: Channel | null
  serverId: string | null
  connected: boolean
  muted: boolean
  deafened: boolean
  speaking: boolean
  participants: VoiceUser[]
  latencyMs?: number
  bitrateKbps?: number
}

export interface CustomEmoji {
  id: string
  serverId: string
  name: string
  url: string
  animated: boolean
  uploadedBy: string
}

export interface WsEvent<T = unknown> {
  type: WsEventType
  data: T
  timestamp: string
}

export type WsEventType =
  | 'MESSAGE_CREATE'
  | 'MESSAGE_UPDATE'
  | 'MESSAGE_DELETE'
  | 'REACTION_ADD'
  | 'REACTION_REMOVE'
  | 'CHANNEL_UPDATE'
  | 'MEMBER_UPDATE'
  | 'PRESENCE_UPDATE'
  | 'VOICE_STATE_UPDATE'
  | 'VOICE_SPEAKING'
  | 'TYPING_START'
  | 'TYPING_STOP'
  | 'SERVER_UPDATE'

export interface TypingIndicator {
  userId: string
  username: string
  channelId: string
  expiresAt: number
}

export interface AppState {
  currentUser: User | null
  currentServerId: string | null
  currentChannelId: string | null
  servers: Record<string, Server>
  members: Record<string, ServerMember>
  messages: Record<string, Message[]>
  voice: VoiceState
  typing: Record<string, TypingIndicator[]>
  ui: UIState
}

export interface UIState {
  membersPanelOpen: boolean
  searchOpen: boolean
  activeModal: ModalType | null
  rightPanelTab: 'members' | 'search' | 'threads'
}

export type ModalType =
  | 'server-settings'
  | 'channel-settings'
  | 'user-profile'
  | 'invite'
  | 'create-channel'
  | 'create-server'
  | 'emoji-manager'
  | 'role-manager'
  | 'rent-server'
