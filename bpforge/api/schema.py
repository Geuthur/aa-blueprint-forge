# Third Party
from ninja import Schema


class UserData(Schema):
    """
    Schema for user data, including character ID and character name.

    Parameters:
        user_id (int): The ID of the user.
        character_id (int): The ID of the character associated with the user.
        character_name (str): The name of the character.
        corporation_id (int): The ID of the corporation associated with the user.
        corporation_name (str): The name of the corporation associated with the user.
        alliance_id (int | None): The ID of the alliance associated with the user, if any.
        alliance_name (str | None): The name of the alliance associated with the user, if any.
        portrait (str | None): The URL or path to the character's portrait image.
        is_admin (boolean): The admin status for the user.
    """

    user_id: int
    character_id: int
    character_name: str
    corporation_id: int
    corporation_name: str
    alliance_id: int | None = None
    alliance_name: str | None = None
    portrait: str | None = None

    is_admin: bool = False
    can_manage_orders: bool = False
    is_global_order_manager: bool = False


class UserSettingsSchema(Schema):
    disable_notifications: bool


class UserSettingsUpdateRequest(Schema):
    disable_notifications: bool


class OwnerStatusSectionSchema(Schema):
    """Status of an individual update section."""

    section: str
    section_name: str
    is_success: bool | None = None
    has_token_error: bool = False
    error_message: str | None = None
    last_run_at: str | None = None
    last_run_finished_at: str | None = None


class OwnerSettingSchema(Schema):
    """User owner configuration in Settings."""

    id: int
    name: str
    is_corporation: bool
    character_id: int | None = None
    character_name: str | None = None
    corporation_id: int | None = None
    corporation_name: str | None = None
    corporation_ticker: str | None = None
    alliance_id: int | None = None
    portrait_url: str | None = None
    is_public: bool = False
    public_type: str = "all"
    selective_bpo_enabled: bool = False
    notify_order_created_group_ids: list[int] = []
    notify_order_status_group_ids: list[int] = []
    blueprint_count: int = 0
    bpo_count: int = 0
    bpc_count: int = 0
    status: str = "incomplete"
    has_error: bool = False
    last_sync: str | None = None
    error_message: str | None = None
    sections: list[OwnerStatusSectionSchema] = []


class UserCharacterStatusSchema(OwnerSettingSchema):
    """Alias schema for character and corporation update status in settings."""


class OwnerSettingUpdateRequest(Schema):
    """Payload to update visibility and settings of an owner."""

    is_public: bool | None = None
    public_type: str | None = None
    selective_bpo_enabled: bool | None = None


# React Stuff


class ModalSchema(Schema):
    """Schema for modal dialog data."""

    title: str
    text: str
    icon: str
    modal_id: str
    url: str
    color: str | None = None
    buttonText: str | None = None


class MenuLink(Schema):
    """
    Represents a link in the menu.

    Parameters:
        name (str): The name of the menu link.
        link (str): The URL or path the menu link points to.
        is_external (bool): Indicates if the link is an external link.
    """

    name: str
    link: str = ""
    is_external: bool = False


class MenuCategory(MenuLink):
    """
    Represents a category in the menu, which can contain multiple links.

    Parameters:
        links (list[MenuLink]): A list of links under this category.
        name (str): The name of the menu category.
        link (str): The optional link for the menu category.
    """

    links: list[MenuLink] = []


class MenuModalSchema(Schema):
    """Schema for menu modals, including the example modal."""

    create_example: ModalSchema | None = None


class MenuSchema(Schema):
    """
    Schema for the overall menu, including links and modals.

    Parameters:
        links (list[MenuLink]): The list of links in the menu.
        modals (MenuModalSchema | None): The modals associated with the menu.
    """

    left_links: list[MenuLink] = []
    right_links: list[MenuLink] = []
    modals: MenuModalSchema | None = None


# Shop & Blueprint Schemas


class OwnerPublicSchema(Schema):
    """Publicly listed Blueprint owner."""

    id: int
    name: str
    is_corporation: bool
    character_id: int | None = None
    corporation_id: int | None = None
    alliance_id: int | None = None
    blueprint_count: int = 0
    bpo_count: int = 0
    bpc_count: int = 0


class BlueprintItemSchema(Schema):
    """Detailed Blueprint item information."""

    item_id: int
    type_id: int
    type_name: str
    group_name: str
    is_original: bool
    is_corp_bp: bool
    runs: int | None = None
    quantity: int = 1
    material_efficiency: int | None = None
    time_efficiency: int | None = None
    location_id: int
    location_name: str
    owner_id: int
    owner_name: str

    @classmethod
    def from_blueprint(cls, bp, include_location: bool = True) -> "BlueprintItemSchema":
        """Construct a BlueprintItemSchema from a Blueprint model object."""
        return cls(
            item_id=bp.item_id,
            type_id=bp.eve_type_id,
            type_name=bp.eve_type.name,
            group_name=bp.eve_type.group.name if bp.eve_type.group else "",
            is_original=bp.is_original,
            is_corp_bp=bp.is_corp_bp,
            runs=bp.runs,
            quantity=bp.quantity,
            material_efficiency=bp.material_efficency,
            time_efficiency=bp.time_efficiency,
            location_id=bp.location_id if include_location else 0,
            location_name=cls.get_location_name(bp) if include_location else "",
            owner_id=bp.owner_id,
            owner_name=bp.owner.name,
        )

    @classmethod
    def get_location_name(cls, bp):
        """Get the location name of a blueprint."""
        if bp.location:
            if bp.location.parent:
                return bp.location.parent.name
            return bp.location.name
        if bp.eve_solar_system:
            return bp.eve_solar_system.name
        return "Unknown"


class OrderItemCreateSchema(Schema):
    """Payload to add a blueprint to an order."""

    blueprint_id: int
    quantity: int = 1
    runs: int | None = None


class OrderCreateRequest(Schema):
    """Payload to place a new order."""

    owner_id: int
    note: str = ""
    items: list[OrderItemCreateSchema]


class OrderItemSchema(Schema):
    """Blueprint line item inside an Order."""

    id: int
    blueprint_id: int
    type_id: int
    type_name: str
    quantity: int
    runs: int | None = None
    material_efficiency: int | None = None
    time_efficiency: int | None = None
    status: str


class OrderSchema(Schema):
    """Full customer order representation."""

    id: int
    owner_id: int
    owner_name: str
    requesting_user_id: int
    requesting_user_name: str
    status: str
    note: str
    items: list[OrderItemSchema]
    created_at: str
    updated_at: str
    closed_at: str | None = None


class OrderStatusUpdateRequest(Schema):
    """Payload to change an order status."""

    status: str


class OwnerBpoItemSchema(Schema):
    """BPO item representation for selective offering in settings."""

    item_id: int
    type_id: int
    type_name: str
    group_name: str
    material_efficiency: int | None = None
    time_efficiency: int | None = None
    location_name: str = ""
    is_offered: bool = False


class OwnerBpoSelectionUpdateRequest(Schema):
    """Payload to update offered BPOs for an owner."""

    offered_item_ids: list[int]


class GroupSchema(Schema):
    """Alliance Auth group representation for notification settings."""

    id: int
    name: str


class SuperuserNotificationSettingsSchema(Schema):
    """Global notification settings for Superusers."""

    order_created_group_ids: list[int]
    order_status_group_ids: list[int]


class SuperuserOwnerUpdateRequest(Schema):
    """Payload for superusers to update owner visibility and notification groups."""

    is_public: bool | None = None
    public_type: str | None = None
    selective_bpo_enabled: bool | None = None
    notify_order_created_group_ids: list[int] | None = None
    notify_order_status_group_ids: list[int] | None = None


class SuperuserUpdateOwnerTaskRequest(Schema):
    """Payload to trigger update_owner Celery task."""

    force_refresh: bool = False


class SuperuserGlobalTaskRequest(Schema):
    """Payload to trigger global owner update task."""

    target: str = "all"
    force_refresh: bool = False


class TaskTriggerResponseSchema(Schema):
    """Response schema for triggered async tasks."""

    success: bool = True
    message: str = ""
