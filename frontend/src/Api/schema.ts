// Third Party
import type { UserData as BaseUserData } from "aa-geuthur-react";

export type { ModalSchema } from "aa-geuthur-react";

// AA bpforge
import type { components } from "@/Api/OpenApi";

// 
export type MenuSchema = components['schemas']['MenuSchema']
/** The `user/` endpoint: the contract of the package plus the fields only this app reads. */
export type UserData = BaseUserData & Pick<components['schemas']['UserData'], 'is_superuser' | 'can_manage_orders' | 'is_global_order_manager'>
export type UserSettingsSchema = components['schemas']['UserSettingsSchema']
export type UserSettingsUpdateRequest = components['schemas']['UserSettingsUpdateRequest']
export type OwnerSettingSchema = components['schemas']['OwnerSettingSchema']
export type OwnerStatusSectionSchema = components['schemas']['OwnerStatusSectionSchema']
export type UserCharacterStatusSchema = components['schemas']['UserCharacterStatusSchema']
export type OwnerSettingUpdateRequest = components['schemas']['OwnerSettingUpdateRequest']
export type OwnerBpoItemSchema = components['schemas']['OwnerBpoItemSchema']
export type OwnerBpoSelectionUpdateRequest = components['schemas']['OwnerBpoSelectionUpdateRequest']
export type GroupSchema = components['schemas']['GroupSchema']
export type AdministrationNotificationSettingsSchema = components['schemas']['AdministrationNotificationSettingsSchema']
export type AdministrationOwnerUpdateRequest = components['schemas']['AdministrationOwnerUpdateRequest']
export type AdministrationUpdateOwnerTaskRequest = components['schemas']['AdministrationUpdateOwnerTaskRequest']
export type TaskTriggerResponseSchema = components['schemas']['TaskTriggerResponseSchema']
export type BlueprintItemSchema = components['schemas']['BlueprintItemSchema']

