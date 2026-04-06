import { Child } from "hono/jsx";

interface AppProps {
  children: Child;
  page?: string;
}

// Icons
const DrawerIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const SunIcon = () => (
  <svg
    className="swap-off h-6 w-6 fill-current"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
  </svg>
);

const MoonIcon = () => (
  <svg
    className="swap-on h-6 w-6 fill-current"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" />
  </svg>
);

const LogoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-8 w-8 text-primary shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    />
  </svg>
);

const DashboardIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const JobsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

// Reusable components
const DrawerToggleButton = () => (
  <label htmlFor="main-drawer" className="btn btn-ghost btn-circle btn-sm">
    <DrawerIcon />
  </label>
);

const ThemeToggle = () => (
  <label className="swap swap-rotate">
    <input type="checkbox" className="theme-controller" value="dracula" />
    <SunIcon />
    <MoonIcon />
  </label>
);

interface SidebarItemProps {
  href: string;
  label: string;
  id: string;
  icon: Child;
}

const SidebarItem = ({ href, label, id, icon }: SidebarItemProps) => (
  <li>
    <a
      hx-get={href}
      hx-target="#job-content-container"
      hx-swap="innerHTML"
      hx-push-url={href}
      id={id}
      className="is-drawer-close:justify-center"
    >
      {icon}
      <span className="is-drawer-close:hidden">{label}</span>
    </a>
  </li>
);

export const app = ({ children, page }: AppProps) => {
  const pageTitle = page === "dashboard" ? "Dashboard" : page === "jobs" ? "Jobs" : page === "settings" ? "Settings" : "🌀◝(ᵔᗜᵔ)◜";

  return (
    <>
      <div className="drawer lg:drawer-open min-h-screen bg-base-100">
        <input id="main-drawer" type="checkbox" className="drawer-toggle" />

        <div className="drawer-content flex flex-col">
          {/* Header */}
          <header className="navbar bg-base-200 px-6 shadow-sm z-10">
            <div className="flex-none">
              <DrawerToggleButton />
            </div>
            <div className="flex-1">
              <h1 id="header-title" className="text-xl font-bold">
                {pageTitle}
              </h1>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1">
            <div id="job-content-container" className="min-h-[400px]">
              {children}
            </div>
          </main>
        </div>

        {/* Delete Confirmation Modal */}
        <dialog id="delete-confirm-modal" className="modal"></dialog>

        {/* Sidebar - Icon-only collapsible drawer */}
        <aside className="drawer-side z-20 is-drawer-close:overflow-visible">
          <label htmlFor="main-drawer" className="drawer-overlay"></label>
          <div className="is-drawer-close:w-20 is-drawer-open:w-64 bg-base-200 border-r border-base-300 flex flex-col items-start min-h-full">
            {/* Logo section */}
            <a
              href="/"
              hx-get="/"
              hx-target="#job-content-container"
              hx-swap="innerHTML"
              hx-push-url="/"
              className="flex items-center gap-3 p-4 w-full hover:bg-base-300 transition-colors"
            >
              <LogoIcon />
              <span className="text-xl font-bold text-primary is-drawer-close:hidden whitespace-nowrap">
                Silicon Seeds
              </span>
            </a>

            {/* Navigation menu */}
            <ul className="menu menu-md w-full grow px-2 py-4">
              <SidebarItem href="/dashboard" label="Dashboard" id="sidebar-dashboard-link" icon={<DashboardIcon />} />
              <SidebarItem href="/jobs" label="Jobs" id="sidebar-jobs-summary" icon={<JobsIcon />} />
              <SidebarItem href="/settings" label="Settings" id="sidebar-settings-link" icon={<SettingsIcon />} />
            </ul>

            {/* Sidebar footer with theme toggle and drawer toggle button */}
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
};
