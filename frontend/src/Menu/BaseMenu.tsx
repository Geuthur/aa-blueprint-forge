// React
import { Link, useLocation } from "react-router";

// Third Party
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Nav } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { loadOrders, loadUserOwners } from "@/Api/ApiCalls";
import type { components } from "@/Api/OpenApi";
import { queryKeys } from "@/Api/query";

export type MenuLinkItem = components["schemas"]["MenuLink"];

export interface MenuCategory {
  name: string;
  link?: string;
  links?: MenuLinkItem[];
}

export interface MenuProps {
  isLoading: boolean;
  data: Array<MenuCategory | MenuLinkItem>;
  error: boolean;
}

export interface ToPath {
    toPath: (link: string) => string;
}

export const OrdersMenuItem = ({ link, toPath }: { link: MenuLinkItem } & ToPath) => {
    const { t } = useTranslation();
    const path = useLocation();
    const hit = path.pathname.endsWith(link.link ?? "");

    const { data: sellerOrders } = useQuery({
        queryKey: queryKeys.Orders("seller"),
        queryFn: () => loadOrders("seller"),
        refetchInterval: 30000,
        staleTime: 15000,
    });

    const openCount = (sellerOrders ?? []).filter(
        (o) => o.status === "Pending" || o.status === "Accepted"
    ).length;

    const hasOpenOrders = openCount > 0;

    return (
        <Nav.Item as="li">
            <Nav.Link
                as={Link}
                to={{ pathname: toPath(link.link ?? ""), search: path.search }}
                id={link.name}
                key={link.name}
                active={hit}
                className={`d-flex align-items-center justify-content-between ${hasOpenOrders ? "aa-order-nav-pulse" : ""}`}
            >
                <span>{t(link.name)}</span>
                {hasOpenOrders && (
                    <span
                        className="badge rounded-pill aa-order-badge ms-2"
                        data-testid="orders-badge"
                    >
                        {openCount}
                    </span>
                )}
            </Nav.Link>
        </Nav.Item>
    );
};

export const SettingsMenuItem = ({ link, toPath }: { link: MenuLinkItem } & ToPath) => {
    const { t } = useTranslation();
    const path = useLocation();
    const hit = path.pathname.endsWith(link.link ?? "");

    const { data: owners } = useQuery({
        queryKey: queryKeys.UserOwners,
        queryFn: () => loadUserOwners(),
        refetchInterval: 30000,
        staleTime: 15000,
    });

    // Has issue if any owner's update status is not ok or has_error is true
    const hasStatusIssue = Boolean(
        owners &&
        owners.length > 0 &&
        owners.some((o) => {
            const status = (o.status || "").toLowerCase();
            return status !== "ok" || Boolean(o.has_error);
        })
    );

    return (
        <Nav.Item as="li">
            <Nav.Link
                as={Link}
                to={{ pathname: toPath(link.link ?? ""), search: path.search }}
                id={link.name}
                key={link.name}
                active={hit}
                className={hasStatusIssue ? "aa-order-nav-pulse" : ""}
                data-testid="settings-nav-link"
            >
                {t(link.name)}
            </Nav.Link>
        </Nav.Item>
    );
};

export const SuperuserMenuItem = ({ link, toPath }: { link: MenuLinkItem } & ToPath) => {
    const { t } = useTranslation();
    const path = useLocation();
    const hit = path.pathname.endsWith(link.link ?? "");

    return (
        <Nav.Item as="li">
            <Nav.Link
                as={Link}
                to={{ pathname: toPath(link.link ?? ""), search: path.search }}
                id={link.name}
                key={link.name}
                active={hit}
                className="aa-nav-danger d-flex align-items-center gap-1"
                data-testid="superuser-nav-link"
            >
                <ShieldAlert size={15} className="text-danger flex-shrink-0" />
                <span>{t(link.name)}</span>
            </Nav.Link>
        </Nav.Item>
    );
};

export const MenuItem = ({ link, toPath }: { link: MenuLinkItem } & ToPath) => {
    const { t } = useTranslation();
    const path = useLocation();
    const hit = path.pathname.endsWith(link.link ?? "");
    const isExternal = Boolean(
        link.is_external ||
        link.link?.startsWith("http://") ||
        link.link?.startsWith("https://")
    );

    if (isExternal) {
        return (
            <Nav.Item as="li">
                <Nav.Link
                    href={link.link ?? "#"}
                    id={link.name}
                    key={link.name}
                >
                    {t(link.name)}
                </Nav.Link>
            </Nav.Item>
        );
    }

    const isOrdersLink = Boolean(
        link.link?.replace(/^\/+|\/+$/g, "") === "orders" ||
        link.name.toLowerCase() === "orders"
    );

    if (isOrdersLink) {
        return <OrdersMenuItem link={link} toPath={toPath} />;
    }

    const isSettingsLink = Boolean(
        link.link?.replace(/^\/+|\/+$/g, "") === "settings" ||
        link.name.toLowerCase() === "settings"
    );

    if (isSettingsLink) {
        return <SettingsMenuItem link={link} toPath={toPath} />;
    }

    const isSuperuserLink = Boolean(
        link.link?.replace(/^\/+|\/+$/g, "") === "superuser" ||
        link.name.toLowerCase() === "superuser"
    );

    if (isSuperuserLink) {
        return <SuperuserMenuItem link={link} toPath={toPath} />;
    }

    return (
        <Nav.Item as="li">
            <Nav.Link
                as={Link}
                to={{ pathname: toPath(link.link ?? ""), search: path.search }}
                id={link.name}
                key={link.name}
                active={hit}
            >
                {t(link.name)}
            </Nav.Link>
        </Nav.Item>
    );
};
