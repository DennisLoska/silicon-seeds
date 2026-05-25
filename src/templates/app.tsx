import { Child } from "hono/jsx";
import { Icons } from "./icons";

interface AppProps {
  children: Child;
  page?: string;
}

const DrawerToggleButton = () => (
  <label htmlFor="main-drawer" className="btn btn-ghost btn-circle btn-sm">
    <Icons.Drawer />
  </label>
);

const ThemeToggle = () => (
  <label className="swap swap-rotate">
    <input type="checkbox" className="theme-controller" value="dracula" />
    <Icons.Sun />
    <Icons.Moon />
  </label>
);

interface SidebarItemProps {
  href: string;
  label: string;
  id: string;
  icon: Child;
}

const SidebarItem = ({ href, label, id, icon }: SidebarItemProps) => (
  <li className="w-full">
    <a
      hx-get={href}
      hx-target="#job-content-container"
      hx-swap="innerHTML"
      hx-push-url={href}
      id={id}
      className="is-drawer-close:justify-center py-2"
    >
      {icon}
      <span className="is-drawer-close:hidden">{label}</span>
    </a>
  </li>
);

export const App = ({ children, page }: AppProps) => (
  <>
    <div className="drawer lg:drawer-open min-h-screen bg-base-100">
      <input id="main-drawer" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content flex flex-col">
        <header className="navbar bg-base-200 px-4 shadow-sm z-10">
          <div className="flex-none">
            <DrawerToggleButton />
          </div>
          <div className="flex-1">
            <h1 id="header-title" className="text-xl pl-1 font-bold">
              {page === "dashboard" && "Dashboard"}
              {page === "jobs" && "Jobs"}
              {page === "gallery" && "Gallery"}
              {page === "settings" && "Settings"}
              {page === "compose" && "Compose"}
              {page === "audio" && "Audio"}
              {page === "autocut" && "AutoCut"}
              {page === "image" && "Image"}
              {page === "video" && "Video"}
              {page === "text" && "Text"}
              {!page && "🌀◝(ᵔᗜᵔ)◜"}
            </h1>
          </div>
        </header>

        <main className="flex-1">
          <div id="job-content-container" className="min-h-[400px]">
            {children}
          </div>
        </main>
      </div>

      <aside className="drawer-side z-20 is-drawer-close:overflow-visible">
        <label htmlFor="main-drawer" className="drawer-overlay"></label>
        <div className="is-drawer-close:w-20 is-drawer-open:w-64 bg-base-200 border-r border-base-300 flex flex-col items-start min-h-full">
          <a
            href="/"
            hx-get="/"
            hx-target="#job-content-container"
            hx-swap="innerHTML"
            hx-push-url="/"
            className="flex items-center is-drawer-close:justify-center gap-3 p-4 w-full hover:bg-base-300 transition-colors"
          >
            <Icons.Logo />
            <span className="text-xl font-bold text-primary is-drawer-close:hidden whitespace-nowrap">
              Silicon Seeds
            </span>
          </a>

          <ul className="menu menu-md w-full grow px-2 py-4">
            <SidebarItem
              href="/dashboard"
              label="Dashboard"
              id="sidebar-dashboard-link"
              icon={<Icons.Dashboard />}
            />
            <SidebarItem
              href="/jobs"
              label="Jobs"
              id="sidebar-jobs-summary"
              icon={<Icons.Jobs />}
            />
            <SidebarItem
              href="/gallery"
              label="Gallery"
              id="sidebar-gallery"
              icon={<Icons.Gallery />}
            />
            <li className="menu-title">Create</li>
            <SidebarItem
              href="/compose"
              label="Compose"
              id="sidebar-compose"
              icon={<Icons.Compose />}
            />
            <SidebarItem
              href="/create/autocut"
              label="AutoCut"
              id="sidebar-autocut"
              icon={<Icons.AutoCutSmall />}
            />
            <SidebarItem
              href="/create/image"
              label="Image"
              id="sidebar-image"
              icon={<Icons.Image />}
            />
            <SidebarItem
              href="/create/video"
              label="Video"
              id="sidebar-video"
              icon={<Icons.Video />}
            />
            <SidebarItem
              href="/create/audio"
              label="Audio"
              id="sidebar-audio"
              icon={<Icons.Audio />}
            />
            <SidebarItem
              href="/create/text"
              label="Text"
              id="sidebar-text"
              icon={<Icons.Text />}
            />
            <li className="menu-title">System</li>
            <SidebarItem
              href="/settings"
              label="Settings"
              id="sidebar-settings-link"
              icon={<Icons.Settings />}
            />
          </ul>

          <div className="w-full px-2 pb-4">
            <div className="flex items-center gap-2 justify-center is-drawer-open:justify-end">
              <DrawerToggleButton />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </aside>
    </div>
  </>
);
