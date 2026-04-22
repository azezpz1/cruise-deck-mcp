export const getDeckLayout = {
  name: "get_deck_layout",
  description: "Return the layout of a single deck — cabins and amenities.",
  inputSchema: {
    type: "object",
    properties: {
      shipName: { type: "string", description: "Name of the ship" },
      deckNumber: { type: "integer", description: "Deck number" },
    },
    required: ["shipName", "deckNumber"],
  },
  async handler(args: Record<string, unknown>) {
    return {
      content: [
        {
          type: "text" as const,
          text: `STUB: get_deck_layout called with ${JSON.stringify(args)}`,
        },
      ],
    };
  },
};
