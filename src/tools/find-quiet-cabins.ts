export const findQuietCabins = {
  name: "find_quiet_cabins",
  description:
    "Find the quietest cabins on a ship, optionally filtered by category.",
  inputSchema: {
    type: "object",
    properties: {
      shipName: { type: "string", description: "Name of the ship" },
      category: {
        type: "string",
        enum: ["inside", "oceanview", "balcony", "suite"],
        description: "Cabin category filter",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 10,
      },
    },
    required: ["shipName"],
  },
  async handler(args: Record<string, unknown>) {
    return {
      content: [
        {
          type: "text" as const,
          text: `STUB: find_quiet_cabins called with ${JSON.stringify(args)}`,
        },
      ],
    };
  },
};
