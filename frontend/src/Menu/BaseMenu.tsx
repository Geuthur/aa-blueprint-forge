// React
import { Link, useLocation } from "react-router-dom";

// Third Party
import { ShieldAlert } from "lucide-react";
import { Nav } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { components } from "@/Api/OpenApi";
import { ProjectName } from "@/constants";
import { useMenuOpenOrderCount, useMenuUserOwners } from "@/Menu/Hooks";

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

const isLinkActive = (link: string | undefined | null, pathname: string) => {
    const cleanLink = (link ?? "").replace(/^\/+|\/+$/g, "");
    const cleanPath = pathname.replace(/^\/+|\/+$/g, "");
    if (cleanLink === "" || cleanLink === "overview") {
        return cleanPath === ProjectName || cleanPath === `${ProjectName}/overview`;
    }
    return cleanPath.endsWith(cleanLink);
};

export const OrdersMenuItem = ({ link, toPath }: { link: MenuLinkItem } & ToPath) => {
    const { t } = useTranslation();
    const path = useLocation();
    const hit = isLinkActive(link.link, path.pathname);

    const openCount = useMenuOpenOrderCount();

    const hasOpenOrders = openCount > 0;

    return (
        <Nav.Item as="li">
            <Nav.Link
                as={Link}
                to={{ pathname: toPath(link.link ?? "") }}
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
    const hit = isLinkActive(link.link, path.pathname);

    const { data: owners } = useMenuUserOwners();

    // An owner has an issue if its update status has error or token_error
    const issueCount = (owners ?? []).filter((o) => {
        const status = (o.status || "").toLowerCase();
        return status === "error" || status === "token_error" || Boolean(o.has_error);
    }).length;
    const hasStatusIssue = Boolean(link.has_errors || issueCount > 0);

    return (
        <Nav.Item as="li">
            <Nav.Link
                as={Link}
                to={{ pathname: toPath(link.link ?? "") }}
                id={link.name}
                key={link.name}
                active={hit}
                data-testid="settings-nav-link"
            >
                {t(link.name)}
                {issueCount > 0 ? (
                    <span className={`badge bg-danger ms-1 ${hasStatusIssue ? "aa-menu-badge-pulse" : ""}`}>
                        {issueCount}
                    </span>
                ) : null}
            </Nav.Link>
        </Nav.Item>
    );
};

export const AdministrationMenuItem = ({ link, toPath }: { link: MenuLinkItem } & ToPath) => {
    const { t } = useTranslation();
    const path = useLocation();
    const hit = isLinkActive(link.link, path.pathname);

    return (
        <Nav.Item as="li">
            <Nav.Link
                as={Link}
                to={{ pathname: toPath(link.link ?? "") }}
                id={link.name}
                key={link.name}
                active={hit}
                className="aa-nav-danger text-danger d-flex align-items-center gap-1"
                data-testid="administration-nav-link"
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
    const hit = isLinkActive(link.link, path.pathname);
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

    const isAdministrationLink = Boolean(
        link.link?.replace(/^\/+|\/+$/g, "") === "administration" ||
        link.name.toLowerCase() === "administration"
    );

    if (isAdministrationLink) {
        return <AdministrationMenuItem link={link} toPath={toPath} />;
    }

    return (
        <Nav.Item as="li">
            <Nav.Link
                as={Link}
                to={{ pathname: toPath(link.link ?? "") }}
                id={link.name}
                key={link.name}
                active={hit}
            >
                {t(link.name)}
            </Nav.Link>
        </Nav.Item>
    );
};
