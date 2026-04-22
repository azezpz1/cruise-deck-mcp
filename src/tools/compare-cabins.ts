export const compareCabins = {
  name: "compare_cabins",
  description: "Compare two or more cabins on the same ship side by side.",
  inputSchema: {
    type: "object",
    properties: {
      shipName: { type: "string", description: "Name of the ship" },
      cabinNumbers: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 5,
        description: "Cabin numbers to compare (2–5)",
      },
    },
    required: ["shipName", "cabinNumbers"],
  },
  async handler(args: Record<string, unknown>) {
    return {
      content: [
        {
          type: "text" as const,
          text: `STUB: compare_cabins called with ${JSON.stringify(args)}`,
        },
      ],
    };
  },
};
