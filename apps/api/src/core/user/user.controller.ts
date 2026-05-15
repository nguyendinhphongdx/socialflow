import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc, CurrentUser, type AuthUser } from '@sociflow/common'
import { UserService } from './user.service'
import { UserVo } from './user.vo'

@ApiTags('User')
@ApiBearerAuth()
@Controller('/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiDoc({ summary: 'Lấy thông tin user hiện tại', response: UserVo })
  @Get('/me')
  async me(@CurrentUser() user: AuthUser) {
    const entity = await this.userService.getById(user.id)
    return UserVo.create(entity)
  }
}
