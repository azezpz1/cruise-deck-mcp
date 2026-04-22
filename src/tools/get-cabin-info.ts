export const getCabinInfo = {
  name: "get_cabin_info",
  description: "Look up details for a specific cabin on a specific ship.",
  inputSchema: {
    type: "object",
    properties: {
      shipName: { type: "string", description: "Name of the ship" },
      cabinNumber: { type: "string", description: "Cabin number (e.g. '8420')" },
    },
    required: ["shipName", "cabinNumber"],
  },
  async handler(args: Record<string, unknown>) {
    return {
      content: [
        {
          type: "text" as const,
          text: `STUB: get_cabin_info called with ${JSON.stringify(args)}`,
        },
      ],
    };
  },
};
