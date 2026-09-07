export type ToolModule = 'flights' | 'hotels';

export type ModuleTool =
  | { module: ToolModule; state: 'active' }
  | { module: ToolModule; state: 'beta' }
  | { module: ToolModule; state: 'retired'; replacement: string };

export const MODULE_TOOLS = {
  cpp_calculator: { module: 'flights', state: 'active' },
  transfer_partner_optimizer: { module: 'flights', state: 'active' },
  kiwi_flight_search: { module: 'flights', state: 'active' },
  trivago_hotel_search: { module: 'hotels', state: 'beta' },
  skiplagged_flight_search: {
    module: 'flights',
    state: 'retired',
    replacement:
      'Hidden-City-Tickets, also das Aussteigen beim Zwischenstopp, bietet MYLO nicht an. Airlines wie Lufthansa werten das als Verstoß gegen ihre Beförderungsbedingungen und können Meilen streichen oder Differenzen nachfordern. Günstige Verbindungen mit Umstieg zeige ich dir hier: [Kiwi-Ergebnisse].',
  },
  sweet_spot_lookup: {
    module: 'flights',
    state: 'retired',
    replacement:
      'Feste Sweet-Spot-Listen führt MYLO nicht mehr, sie stammen aus dem US-Markt und passen nicht zu deutschen Programmen. Die aktuell besten Prämien-Einlösungen findest du unter Deals.',
  },
  ferryhopper_search: {
    module: 'flights',
    state: 'retired',
    replacement:
      'Fährverbindungen sucht MYLO nicht direkt. Ich nenne dir Anbieter und Routen aus der Websuche.',
  },
} as const satisfies Record<string, ModuleTool>;

export type ModuleToolName = keyof typeof MODULE_TOOLS;

export function enabledModuleToolNames(): ModuleToolName[] {
  return (Object.keys(MODULE_TOOLS) as ModuleToolName[]).filter(
    (name) => MODULE_TOOLS[name].state !== 'retired',
  );
}

export function retiredModuleTools(): Array<{
  name: ModuleToolName;
  replacement: string;
}> {
  return (Object.keys(MODULE_TOOLS) as ModuleToolName[]).flatMap((name) => {
    const tool = MODULE_TOOLS[name];
    return tool.state === 'retired'
      ? [{ name, replacement: tool.replacement }]
      : [];
  });
}
