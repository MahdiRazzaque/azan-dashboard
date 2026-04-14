import React from "react";

const DashboardLayout = ({ children }) => {
  return (
    <div className="h-auto lg:h-full w-full p-4 flex flex-col-reverse lg:grid lg:grid-cols-2 gap-4">
      {children}
    </div>
  );
};

export default DashboardLayout;
