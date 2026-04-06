export const OobHeader = ({ title }: { title: string }) => (
  <div id="header-title" hx-swap-oob="true">
    <h1 className="text-xl pl-1 font-bold">{title}</h1>
  </div>
);
