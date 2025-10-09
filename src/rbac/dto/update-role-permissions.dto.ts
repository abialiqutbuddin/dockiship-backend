import { IsArray, ArrayNotEmpty, IsString, ArrayUnique } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  permissionNames!: string[]; // e.g., ["inventory.read", "purchases.update"]
}