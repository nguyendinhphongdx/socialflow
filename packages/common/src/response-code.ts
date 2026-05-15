/**
 * Response code enum — số nguyên, range theo module.
 *
 * Convention:
 * - 0           : success
 * - 10000-10999 : validation / framework
 * - 11000-11999 : auth (login, JWT, session)
 * - 12000-12999 : user
 * - 13000-13999 : account (social account)
 * - 14000-14999 : media / storage
 * - 15000-15999 : publish
 * - 16000-16999 : AI
 * - 17000-17999 : engagement
 * - 18000-18999 : agent / extension
 * - 19000+      : module-specific (allocate khi cần)
 */
export enum ResponseCode {
  Success = 0,

  // Validation / framework — 10000+
  ValidationFailed = 10001,
  BadRequest = 10002,
  InternalError = 10500,

  // Auth — 11000+
  AuthRequired = 11000,
  InvalidCredentials = 11001,
  SessionExpired = 11002,
  SessionNotFound = 11003,
  EmailAlreadyExists = 11004,
  RefreshTokenInvalid = 11005,
  RefreshTokenReused = 11006,
  AccessDenied = 11007,
  RateLimitExceeded = 11008,

  // User — 12000+
  UserNotFound = 12000,
  UserSuspended = 12001,

  // Social account — 13000+
  AccountNotFound = 13000,
  AccountOAuthFailed = 13001,
  AccountTokenExpired = 13002,

  // Media — 14000+
  MediaNotFound = 14000,
  MediaUploadFailed = 14001,
  MediaSizeExceeded = 14002,
  MediaTypeNotAllowed = 14003,

  // Publish — 15000+
  PublishTaskNotFound = 15000,
  PublishTaskInvalid = 15001,
  PublishRejectedByPlatform = 15002,
  PublishFailed = 15003,

  // AI — 16000+
  AiCreditInsufficient = 16000,
  AiGenerationFailed = 16001,
  AiQuotaExceeded = 16002,

  // Engagement / monitoring / insight — 17000+
  EngagementRateLimit = 17000,
  EngagementInvalidComment = 17001,
  CommentNotFound = 17002,
  CommentReplyFailed = 17003,
  AutoReplyRuleNotFound = 17004,
  AutoReplyQuotaExceeded = 17005,
  BrandMonitorNotFound = 17006,
  InsightFetchFailed = 17007,
  InsightNotFound = 17008,

  // Agent / extension — 18000+
  AgentOffline = 18000,
  AgentPairingInvalid = 18001,
  AgentVersionMismatch = 18002,
  AgentPairCodeExpired = 18003,
  AgentAlreadyClaimed = 18004,
  AgentNotFound = 18005,

  // Draft — 19000+
  DraftNotFound = 19000,
}

/** Default message mapping. UI-facing tiếng Việt. */
export const ResponseMessage: Record<ResponseCode, string> = {
  [ResponseCode.Success]: 'Thành công',

  [ResponseCode.ValidationFailed]: 'Dữ liệu không hợp lệ',
  [ResponseCode.BadRequest]: 'Yêu cầu không hợp lệ',
  [ResponseCode.InternalError]: 'Lỗi hệ thống, vui lòng thử lại',

  [ResponseCode.AuthRequired]: 'Vui lòng đăng nhập',
  [ResponseCode.InvalidCredentials]: 'Email hoặc mật khẩu không đúng',
  [ResponseCode.SessionExpired]: 'Phiên đã hết hạn',
  [ResponseCode.SessionNotFound]: 'Không tìm thấy phiên đăng nhập',
  [ResponseCode.EmailAlreadyExists]: 'Email đã được sử dụng',
  [ResponseCode.RefreshTokenInvalid]: 'Refresh token không hợp lệ',
  [ResponseCode.RefreshTokenReused]: 'Phát hiện refresh token đã sử dụng — đã thu hồi toàn bộ phiên',
  [ResponseCode.AccessDenied]: 'Không có quyền truy cập',
  [ResponseCode.RateLimitExceeded]: 'Đã vượt quá giới hạn yêu cầu',

  [ResponseCode.UserNotFound]: 'Không tìm thấy người dùng',
  [ResponseCode.UserSuspended]: 'Tài khoản đã bị tạm khoá',

  [ResponseCode.AccountNotFound]: 'Không tìm thấy tài khoản',
  [ResponseCode.AccountOAuthFailed]: 'OAuth thất bại',
  [ResponseCode.AccountTokenExpired]: 'Token tài khoản đã hết hạn',

  [ResponseCode.MediaNotFound]: 'Không tìm thấy media',
  [ResponseCode.MediaUploadFailed]: 'Upload media thất bại',
  [ResponseCode.MediaSizeExceeded]: 'File vượt quá dung lượng cho phép',
  [ResponseCode.MediaTypeNotAllowed]: 'Định dạng file không được hỗ trợ',

  [ResponseCode.PublishTaskNotFound]: 'Không tìm thấy publish task',
  [ResponseCode.PublishTaskInvalid]: 'Publish task không hợp lệ',
  [ResponseCode.PublishRejectedByPlatform]: 'Nội dung bị nền tảng từ chối',
  [ResponseCode.PublishFailed]: 'Đăng bài thất bại',

  [ResponseCode.AiCreditInsufficient]: 'Không đủ AI credit',
  [ResponseCode.AiGenerationFailed]: 'AI generation thất bại',
  [ResponseCode.AiQuotaExceeded]: 'Đã vượt quota AI',

  [ResponseCode.EngagementRateLimit]: 'Đã vượt giới hạn auto-reply',
  [ResponseCode.EngagementInvalidComment]: 'Comment không tồn tại hoặc đã bị xoá',
  [ResponseCode.CommentNotFound]: 'Không tìm thấy comment',
  [ResponseCode.CommentReplyFailed]: 'Reply comment thất bại',
  [ResponseCode.AutoReplyRuleNotFound]: 'Không tìm thấy rule auto-reply',
  [ResponseCode.AutoReplyQuotaExceeded]: 'Rule đã vượt quota reply trong ngày',
  [ResponseCode.BrandMonitorNotFound]: 'Không tìm thấy brand monitor',
  [ResponseCode.InsightFetchFailed]: 'Lấy metric thất bại',
  [ResponseCode.InsightNotFound]: 'Không tìm thấy insight',

  [ResponseCode.AgentOffline]: 'Browser agent đang offline',
  [ResponseCode.AgentPairingInvalid]: 'Mã pair không hợp lệ',
  [ResponseCode.AgentVersionMismatch]: 'Phiên bản extension không tương thích',
  [ResponseCode.AgentPairCodeExpired]: 'Mã pair đã hết hạn, vui lòng tạo mã mới',
  [ResponseCode.AgentAlreadyClaimed]: 'Mã pair đã được sử dụng',
  [ResponseCode.AgentNotFound]: 'Không tìm thấy browser agent',

  [ResponseCode.DraftNotFound]: 'Không tìm thấy bản nháp',
}
