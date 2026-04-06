export const OobHeader = ({ title }: { title: string }) => (
  <div id="header-title" hx-swap-oob="true">
    <h1 className="text-xl font-bold">{title}</h1>
  </div>
);
