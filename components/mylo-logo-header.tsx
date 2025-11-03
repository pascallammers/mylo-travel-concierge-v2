import React from 'react';
import { MyloLogo } from './logos/mylo-logo';

export const MyloLogoHeader = () => (
  <div className="flex items-center gap-2 my-1.5">
    <MyloLogo className="size-7" />
    <h2 className="text-xl font-normal font-be-vietnam-pro text-foreground dark:text-foreground">MYLO</h2>
  </div>
);
