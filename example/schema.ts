import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const maps = defineTable({
  name: v.string(),
  width: v.number(),
  height: v.number(),
}).index("foo", ["name"]);

const someTables = {
  foos: defineTable({
    name: v.string(),
    width: v.number(),
    height: v.number(),
  }).index("foo", ["name"]),
};

const x = "asdsadasd";

const schema =
  //  {
  //   users: { cool: "ssadsa" },
  // };

  defineSchema(
    {
      ...someTables,
      maps,
      markers: defineTable({
        x: v.number(),
        y: v.number(),
      }).index("mapCell", ["x", "y"]),
      bads: defineTable(
        v.union(v.object({ x: v.number() }), v.object({ y: v.string() })),
      ),
    },
    { schemaValidation: true },
  );

export default schema;
