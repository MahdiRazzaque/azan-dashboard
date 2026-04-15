import React from "react";

const DashboardLayout = ({ children }) => {
  return (
    <div className="h-auto lg:h-full w-full p-[clamp(0.75rem,1.5vw,1.5rem)] flex flex-col-reverse lg:grid lg:grid-cols-2 gap-[clamp(0.75rem,1.5vw,1.5rem)]">
      {children}
    </div>
  );
};

export default DashboardLayout;
