"""Models for Requests."""

# Django
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

# Alliance Auth
from allianceauth.authentication.models import User

# AA Blueprint Forge
from bpforge.models.blueprint import Blueprint
from bpforge.models.helpers.core import RequestStatus

OPEN_ORDER_STATUSES = (RequestStatus.PENDING, RequestStatus.ACCEPTED)


class Order(models.Model):
    """Represents a customer order placed with a blueprint shop/owner."""

    class Meta:
        default_permissions = ()
        ordering = ["-created_at"]

    owner = models.ForeignKey(
        "bpforge.Owner",
        on_delete=models.SET_NULL,
        related_name="orders",
        null=True,
        blank=True,
        help_text=_("The shop/owner this order was placed with."),
    )

    requesting_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="bpforge_orders",
        null=True,
        blank=True,
        help_text=_("The user who placed the order."),
    )

    # Copy of the parties, keeps the order traceable when they are deleted
    owner_name = models.CharField(
        max_length=254,
        blank=True,
        default="",
        help_text=_("The name of the shop/owner when the order was placed."),
    )

    requesting_user_name = models.CharField(
        max_length=254,
        blank=True,
        default="",
        help_text=_("The name of the buyer when the order was placed."),
    )

    seller_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
        help_text=_("The user who owned the shop when the order was placed."),
    )

    owner_corporation_id = models.BigIntegerField(
        blank=True,
        null=True,
        help_text=_("The corporation ID of the shop when the order was placed."),
    )

    status = models.CharField(
        help_text=_("The status of this order."),
        choices=RequestStatus.choices,
        default=RequestStatus.PENDING,
        max_length=36,
    )

    note = models.TextField(
        blank=True,
        default="",
        help_text=_("Customer note or instructions for the order."),
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text=_("The time this order was created."),
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        help_text=_("The time this order was last updated."),
    )

    closed_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text=_("The time this order was closed."),
    )

    def __str__(self):
        return (
            f"Order #{self.pk} - {self.display_owner_name} - "
            f"{self.display_buyer_name} ({self.status})"
        )

    @property
    def display_owner_name(self) -> str:
        """Current name of the shop, or the copy once it is gone."""
        return self.owner.name if self.owner else self.owner_name

    @property
    def display_buyer_name(self) -> str:
        """Current name of the buyer, or the copy once the user is gone."""
        user = self.requesting_user
        if user is None:
            return self.requesting_user_name
        try:
            return user.profile.main_character.character_name
        except AttributeError:
            return user.username

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.owner_name = self.display_owner_name
            self.requesting_user_name = self.display_buyer_name
            if self.owner:
                self.seller_user = self.owner.user
                self.owner_corporation_id = self.owner.corporation_id_of_shop
        super().save(*args, **kwargs)

    def handle_status(self, user: User, status: str, can_edit: bool = False) -> bool:
        """Update the order status and associated items."""
        is_owner = self.seller_user_id == user.pk
        is_requester = self.requesting_user == user

        # Only the requester can cancel, and only if still pending
        if status == RequestStatus.CANCELLED:
            if not is_requester or self.status != RequestStatus.PENDING:
                return False
            self.status = RequestStatus.CANCELLED
            self.closed_at = timezone.now()
            self.save(update_fields=["status", "closed_at", "updated_at"])
            self.items.update(status=RequestStatus.CANCELLED, closed_at=timezone.now())
            return True

        # Owner or user with manage/admin rights can accept, deliver, or decline
        if is_owner or can_edit:
            self.status = status
            if status in [RequestStatus.DELIVERED, RequestStatus.DECLINED]:
                self.closed_at = timezone.now()
            else:
                self.closed_at = None
            self.save(update_fields=["status", "closed_at", "updated_at"])
            self.items.update(
                status=status,
                assignee_user=user,
                closed_at=self.closed_at,
            )
            return True

        return False


class Request(models.Model):
    class Meta:
        default_permissions = ()

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
        null=True,
        blank=True,
        help_text=_("The parent order for this blueprint item."),
    )

    blueprint = models.ForeignKey(
        Blueprint,
        on_delete=models.SET_NULL,
        related_name="bpforge_requests",
        null=True,
        blank=True,
        help_text=_("The blueprint being requested."),
    )

    # Copy of the blueprint, keeps the item readable when ESI no longer returns it
    item_id = models.BigIntegerField(
        default=0,
        help_text=_("The Eve ID of the blueprint when it was ordered."),
    )

    type_id = models.IntegerField(
        default=0,
        help_text=_("The Eve type ID of the blueprint when it was ordered."),
    )

    type_name = models.CharField(
        max_length=250,
        blank=True,
        default="",
        help_text=_("The Eve type name of the blueprint when it was ordered."),
    )

    material_efficiency = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text=_("The material efficiency of the blueprint when it was ordered."),
    )

    time_efficiency = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text=_("The time efficiency of the blueprint when it was ordered."),
    )

    location_name = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text=_("The location name of the blueprint when it was ordered."),
    )

    requesting_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
        help_text=_("The user who made this request."),
    )

    assignee_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text=_("The user assigned to this request."),
        null=True,
        blank=True,
    )

    quantity = models.PositiveIntegerField(
        default=1,
        help_text=_("The quantity of copies/blueprints being requested."),
    )

    runs = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text=_("The number of runs being requested."),
    )

    status = models.CharField(
        help_text=_("The status of this request."),
        choices=RequestStatus.choices,
        default=RequestStatus.PENDING,
        max_length=36,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text=_("The time this request was created."),
    )

    closed_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text=_("The time this request was closed."),
    )

    def __str__(self):
        blueprint = self.blueprint or self.type_name
        return f"{blueprint} - {self.requesting_user} - {self.status}"

    def save(self, *args, **kwargs):
        if self._state.adding and self.blueprint:
            self.item_id = self.blueprint.item_id
            self.type_id = self.blueprint.eve_type_id
            self.type_name = self.blueprint.eve_type.name
            self.material_efficiency = self.blueprint.material_efficency
            self.time_efficiency = self.blueprint.time_efficiency
            self.location_name = self.blueprint.location_name
        super().save(*args, **kwargs)

    def handle_request(
        self, user: User, status: str, closed: bool, can_edit: bool = False
    ):
        """Change the status of a Blueprint request."""
        if self.requesting_user == user or can_edit:
            if closed:
                self.closed_at = timezone.now()
            else:
                self.closed_at = None

            if status in [RequestStatus.PENDING, RequestStatus.DELIVERED]:
                edited_by = user
            else:
                edited_by = None

            self.assignee_user = edited_by
            self.status = status
            self.save()
            return True

        return False
