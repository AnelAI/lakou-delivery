/**
 * OpenAPI 3.0 specification for the Lakou Delivery REST API.
 *
 * Single source of truth consumed by:
 *   - GET /api/docs        → returns this document as JSON
 *   - /api-docs            → renders Swagger UI from this document
 *
 * Conventions
 * -----------
 * - All admin endpoints require the `lakou_admin_session` cookie issued by
 *   POST /api/auth/login. Public endpoints (`/api/track/{orderNumber}`) are
 *   explicitly marked with `security: []`.
 * - Error responses follow the shape `{ "error": string }`.
 * - All timestamps are ISO 8601 strings (UTC).
 * - Coordinates are decimal degrees (WGS84).
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Lakou Delivery API",
    version: "1.0.0",
    description: [
      "REST API powering the **Lakou Delivery** platform — courier dispatching,",
      "live GPS tracking, merchant catalog and customer order tracking.",
      "",
      "## Authentication",
      "Admin endpoints are protected by an HMAC-signed session cookie",
      "(`lakou_admin_session`) issued by `POST /api/auth/login`. The cookie is",
      "`HttpOnly` and `SameSite=Lax`; Swagger UI sends it automatically thanks",
      "to `withCredentials: true`.",
      "",
      "## Realtime",
      "Mutating endpoints publish events on Pusher channels",
      "(`admin-channel`, `courier-{id}`, `order-{orderNumber}`). The HTTP",
      "response is returned immediately; clients subscribe to Pusher to receive",
      "live updates.",
      "",
      "## Errors",
      "Errors are JSON objects of the form `{ \"error\": \"message\" }` with the",
      "appropriate HTTP status (`400`, `401`, `404`, `500`).",
    ].join("\n"),
    contact: { name: "Lakou Delivery", url: "https://github.com/anelai/lakou-delivery" },
    license: { name: "Proprietary" },
  },

  servers: [
    { url: "/", description: "Current host" },
  ],

  tags: [
    { name: "Auth",       description: "Admin authentication" },
    { name: "Deliveries", description: "Orders / deliveries lifecycle" },
    { name: "Couriers",   description: "Courier roster and statistics" },
    { name: "Merchants",  description: "Merchant catalog (OSM-seeded)" },
    { name: "Tracking",   description: "Realtime GPS ingestion" },
    { name: "Public",     description: "Customer-facing order tracking (no auth)" },
    { name: "Alerts",     description: "Operational alerts (pauses, incidents)" },
    { name: "Stats",      description: "Aggregated dashboard metrics" },
    { name: "Admin",      description: "Maintenance / seeding" },
  ],

  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "lakou_admin_session",
        description:
          "HMAC-signed session cookie issued by `POST /api/auth/login`. " +
          "Lifetime: 7 days.",
      },
    },

    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: { error: { type: "string", example: "Failed to fetch deliveries" } },
      },

      // ── Courier ──────────────────────────────────────────────────────────
      Courier: {
        type: "object",
        required: ["id", "name", "phone", "status"],
        properties: {
          id:         { type: "string", format: "uuid" },
          name:       { type: "string", example: "Karim Ben Ali" },
          phone:      { type: "string", example: "+216 22 333 444" },
          photo:      { type: "string", nullable: true, example: "https://…/photo.jpg" },
          status:     {
            type: "string",
            enum: ["offline", "available", "busy"],
            description: "Operational state derived from assignments and GPS.",
          },
          currentLat: { type: "number", format: "double", nullable: true, example: 36.806 },
          currentLng: { type: "number", format: "double", nullable: true, example: 10.181 },
          lastSeen:   { type: "string", format: "date-time", nullable: true },
          speed:      { type: "number", format: "double", description: "km/h" },
          heading:    { type: "number", format: "double", description: "degrees, 0=N" },
          createdAt:  { type: "string", format: "date-time" },
        },
      },
      CourierWithStats: {
        allOf: [
          { $ref: "#/components/schemas/Courier" },
          {
            type: "object",
            properties: {
              deliveredCount:  { type: "integer", description: "Total delivered, all-time." },
              deliveredToday:  { type: "integer", description: "Delivered since 00:00 local time." },
              deliveries:      { type: "array", items: { $ref: "#/components/schemas/Delivery" } },
              alerts:          { type: "array", items: { $ref: "#/components/schemas/Alert" } },
            },
          },
        ],
      },
      CourierCreate: {
        type: "object",
        required: ["name", "phone"],
        properties: {
          name:  { type: "string", example: "Karim Ben Ali" },
          phone: { type: "string", example: "+216 22 333 444" },
          photo: { type: "string", nullable: true },
        },
      },
      CourierUpdate: {
        type: "object",
        description: "Partial update — any subset of Courier mutable fields.",
        properties: {
          name:   { type: "string" },
          phone:  { type: "string" },
          photo:  { type: "string", nullable: true },
          status: { type: "string", enum: ["offline", "available", "busy"] },
        },
      },
      CourierStats: {
        type: "object",
        properties: {
          today:    { $ref: "#/components/schemas/StatsBucket" },
          week:     { $ref: "#/components/schemas/StatsBucket" },
          month:    { $ref: "#/components/schemas/StatsBucket" },
          allTime:  { $ref: "#/components/schemas/StatsBucket" },
          avgMinutes: {
            type: "integer",
            nullable: true,
            description: "Average minutes between assignment and delivery.",
          },
          active:     { type: "integer", description: "In-progress deliveries." },
          alertCount: { type: "integer", description: "Unresolved alerts." },
          history:    { type: "array", items: { $ref: "#/components/schemas/Delivery" } },
        },
      },
      StatsBucket: {
        type: "object",
        properties: {
          count:   { type: "integer" },
          revenue: { type: "number", format: "double", description: "Tunisian Dinars (DT)." },
        },
      },

      // ── Delivery ─────────────────────────────────────────────────────────
      DeliveryStatus: {
        type: "string",
        enum: ["pending", "assigned", "picked_up", "delivered", "cancelled"],
      },
      Delivery: {
        type: "object",
        required: [
          "id", "orderNumber", "customerName", "customerPhone",
          "pickupAddress", "pickupLat", "pickupLng",
          "deliveryAddress", "deliveryLat", "deliveryLng",
          "status", "priority", "createdAt",
        ],
        properties: {
          id:                  { type: "string", format: "uuid" },
          orderNumber:         { type: "string", example: "ORD-1714742400000-481" },
          customerName:        { type: "string" },
          customerPhone:       { type: "string" },
          pickupAddress:       { type: "string" },
          pickupLat:           { type: "number", format: "double" },
          pickupLng:           { type: "number", format: "double" },
          deliveryAddress:     { type: "string" },
          deliveryLat:         { type: "number", format: "double" },
          deliveryLng:         { type: "number", format: "double" },
          notes:               { type: "string", nullable: true },
          deliveryDescription: { type: "string", nullable: true },
          locationConfirmed:   { type: "boolean" },
          category:            { type: "string", nullable: true },
          merchantId:          { type: "string", format: "uuid", nullable: true },
          merchant:            { allOf: [{ $ref: "#/components/schemas/Merchant" }], nullable: true },
          status:              { $ref: "#/components/schemas/DeliveryStatus" },
          courierId:           { type: "string", format: "uuid", nullable: true },
          courier:             { allOf: [{ $ref: "#/components/schemas/Courier" }], nullable: true },
          priority:            { type: "integer", minimum: 0, description: "0 = standard, higher = more urgent." },
          price:               { type: "number", format: "double", nullable: true, description: "DT" },
          estimatedTime:       { type: "integer", nullable: true, description: "Minutes." },
          distance:            { type: "number", format: "double", nullable: true, description: "Total km (pickup + delivery)." },
          assignedAt:          { type: "string", format: "date-time", nullable: true },
          pickedUpAt:          { type: "string", format: "date-time", nullable: true },
          deliveredAt:         { type: "string", format: "date-time", nullable: true },
          createdAt:           { type: "string", format: "date-time" },
        },
      },
      DeliveryCreate: {
        type: "object",
        required: [
          "customerName", "pickupAddress", "pickupLat", "pickupLng",
          "deliveryAddress", "deliveryLat", "deliveryLng",
        ],
        properties: {
          customerName:        { type: "string" },
          customerPhone:       { type: "string" },
          pickupAddress:       { type: "string" },
          pickupLat:           { type: "number", format: "double" },
          pickupLng:           { type: "number", format: "double" },
          deliveryAddress:     { type: "string" },
          deliveryLat:         { type: "number", format: "double" },
          deliveryLng:         { type: "number", format: "double" },
          notes:               { type: "string", nullable: true },
          deliveryDescription: { type: "string", nullable: true },
          locationConfirmed:   { type: "boolean", default: true },
          category:            { type: "string", nullable: true },
          merchantId:          { type: "string", format: "uuid", nullable: true },
          priority:            { type: "integer", minimum: 0, default: 0 },
          price:               { type: "number", format: "double", nullable: true },
        },
      },
      DeliveryPatch: {
        type: "object",
        description: [
          "Single endpoint that handles **two** kinds of updates:",
          "",
          "1. **Action-driven transitions** — provide an `action` field. The",
          "   action determines which extra fields are read and what side",
          "   effects (status change, courier reassignment, Pusher events)",
          "   the server performs.",
          "2. **Free-form partial update** — omit `action` to PATCH any",
          "   subset of mutable Delivery fields.",
        ].join("\n"),
        properties: {
          action: {
            type: "string",
            enum: [
              "assign", "unassign", "pickup", "deliver", "cancel",
              "confirm-location", "confirm-pickup",
              "update-price", "update-priority", "update-notes",
              "acknowledge",
            ],
          },
          courierId: { type: "string", format: "uuid", description: "Required when `action=assign`." },
          lat:       { type: "number", format: "double", description: "Required for `confirm-location` / `confirm-pickup`." },
          lng:       { type: "number", format: "double", description: "Required for `confirm-location` / `confirm-pickup`." },
          address:   { type: "string", description: "Optional for `confirm-pickup`." },
          price:     { type: "number", format: "double", nullable: true, description: "Used by `update-price`." },
          priority:  { type: "integer", description: "Used by `update-priority`." },
          notes:     { type: "string", nullable: true, description: "Used by `update-notes`." },
        },
      },

      // ── Merchant ─────────────────────────────────────────────────────────
      Merchant: {
        type: "object",
        required: ["id", "name", "category", "lat", "lng", "active"],
        properties: {
          id:        { type: "string", format: "uuid" },
          osmId:     { type: "string", nullable: true, description: "OpenStreetMap node id." },
          name:      { type: "string" },
          category:  { type: "string", example: "restaurant" },
          address:   { type: "string", nullable: true },
          lat:       { type: "number", format: "double" },
          lng:       { type: "number", format: "double" },
          phone:     { type: "string", nullable: true },
          website:   { type: "string", nullable: true },
          active:    { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      MerchantUpdate: {
        type: "object",
        description: "Partial update.",
        properties: {
          name:     { type: "string" },
          category: { type: "string" },
          address:  { type: "string", nullable: true },
          lat:      { type: "number", format: "double" },
          lng:      { type: "number", format: "double" },
          phone:    { type: "string", nullable: true },
          website:  { type: "string", nullable: true },
          active:   { type: "boolean" },
        },
      },

      // ── Alert ────────────────────────────────────────────────────────────
      Alert: {
        type: "object",
        required: ["id", "courierId", "type", "message", "severity", "resolved", "createdAt"],
        properties: {
          id:         { type: "string", format: "uuid" },
          courierId:  { type: "string", format: "uuid" },
          type:       { type: "string", example: "unauthorized_pause" },
          message:    { type: "string" },
          severity:   { type: "string", enum: ["info", "warning", "critical"] },
          resolved:   { type: "boolean" },
          resolvedAt: { type: "string", format: "date-time", nullable: true },
          createdAt:  { type: "string", format: "date-time" },
          courier:    {
            type: "object",
            properties: {
              id:    { type: "string", format: "uuid" },
              name:  { type: "string" },
              phone: { type: "string" },
            },
          },
        },
      },
      AlertUpdate: {
        type: "object",
        properties: {
          resolved: { type: "boolean" },
          message:  { type: "string" },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
        },
      },

      // ── Tracking ─────────────────────────────────────────────────────────
      TrackingPing: {
        type: "object",
        required: ["courierId", "lat", "lng"],
        properties: {
          courierId: { type: "string", format: "uuid" },
          lat:       { type: "number", format: "double" },
          lng:       { type: "number", format: "double" },
          speed:     { type: "number", format: "double", description: "km/h", default: 0 },
          heading:   { type: "number", format: "double", description: "degrees", default: 0 },
        },
      },

      // ── Stats ────────────────────────────────────────────────────────────
      DashboardStats: {
        type: "object",
        properties: {
          totalCouriers:     { type: "integer" },
          activeCouriers:    { type: "integer", description: "Couriers in `available` or `busy`." },
          pendingDeliveries: { type: "integer" },
          activeDeliveries:  { type: "integer", description: "Status `assigned` or `picked_up`." },
          deliveredToday:    { type: "integer" },
          activeAlerts:      { type: "integer" },
        },
      },

      OkResponse: {
        type: "object",
        properties: { ok: { type: "boolean", example: true } },
      },
      SuccessResponse: {
        type: "object",
        properties: { success: { type: "boolean", example: true } },
      },
      SeedResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          total:   { type: "integer" },
          created: { type: "integer" },
          updated: { type: "integer" },
        },
      },
    },

    parameters: {
      DeliveryId: {
        name: "id", in: "path", required: true,
        description: "Delivery UUID.",
        schema: { type: "string", format: "uuid" },
      },
      CourierId: {
        name: "id", in: "path", required: true,
        description: "Courier UUID.",
        schema: { type: "string", format: "uuid" },
      },
      MerchantId: {
        name: "id", in: "path", required: true,
        description: "Merchant UUID.",
        schema: { type: "string", format: "uuid" },
      },
      AlertId: {
        name: "id", in: "path", required: true,
        description: "Alert UUID.",
        schema: { type: "string", format: "uuid" },
      },
      OrderNumber: {
        name: "orderNumber", in: "path", required: true,
        description: "Public order reference, e.g. `ORD-1714742400000-481`.",
        schema: { type: "string" },
      },
    },

    responses: {
      Unauthorized: {
        description: "Missing or invalid session cookie.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: {
        description: "Resource not found.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      BadRequest: {
        description: "Validation error — required field missing or malformed.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      ServerError: {
        description: "Unexpected server error.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
  },

  security: [{ sessionCookie: [] }],

  paths: {
    // ── Auth ───────────────────────────────────────────────────────────────
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Sign in as administrator",
        description:
          "Validates `password` against the `ADMIN_PASSWORD` env var and " +
          "returns an HMAC-signed session cookie (`lakou_admin_session`, " +
          "7-day lifetime, `HttpOnly`, `SameSite=Lax`).",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: { password: { type: "string", format: "password" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful — session cookie set.",
            headers: {
              "Set-Cookie": {
                description: "lakou_admin_session=…; HttpOnly; SameSite=Lax; Max-Age=604800",
                schema: { type: "string" },
              },
            },
            content: { "application/json": { schema: { $ref: "#/components/schemas/OkResponse" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Sign out",
        description: "Clears the session cookie. Always returns 200.",
        security: [],
        responses: {
          "200": { description: "Cookie cleared.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/OkResponse" } } } },
        },
      },
    },

    // ── Deliveries ────────────────────────────────────────────────────────
    "/api/deliveries": {
      get: {
        tags: ["Deliveries"],
        summary: "List deliveries",
        description:
          "Returns deliveries ordered by `priority DESC, createdAt ASC`. " +
          "Optionally filter by status or courier.",
        parameters: [
          { name: "status", in: "query",
            schema: { $ref: "#/components/schemas/DeliveryStatus" },
            description: "Restrict to a single status." },
          { name: "courierId", in: "query",
            schema: { type: "string", format: "uuid" },
            description: "Restrict to a single courier." },
        ],
        responses: {
          "200": {
            description: "Deliveries.",
            content: { "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/Delivery" } },
            } },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Deliveries"],
        summary: "Create a delivery",
        description:
          "Generates a unique `orderNumber` and broadcasts a " +
          "`deliveries:new` Pusher event on `admin-channel`.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/DeliveryCreate" } } },
        },
        responses: {
          "201": { description: "Created.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Delivery" } } } },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/api/deliveries/{id}": {
      get: {
        tags: ["Deliveries"],
        summary: "Get a delivery by id",
        parameters: [{ $ref: "#/components/parameters/DeliveryId" }],
        responses: {
          "200": { description: "Delivery.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Delivery" } } } },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      patch: {
        tags: ["Deliveries"],
        summary: "Update a delivery (action-driven)",
        description:
          "Drives the delivery state-machine. Each `action` value triggers a " +
          "specific transition and may publish Pusher events on " +
          "`admin-channel`, `courier-{id}` and `order-{orderNumber}`.\n\n" +
          "| action | effect |\n" +
          "|--------|--------|\n" +
          "| `assign` | Assigns `courierId`, recomputes `distance` & `estimatedTime`, sets `status=assigned`. |\n" +
          "| `unassign` | Clears courier, status → `pending`. |\n" +
          "| `pickup` | status → `picked_up`, sets `pickedUpAt`. |\n" +
          "| `deliver` | status → `delivered`, sets `deliveredAt`, frees the courier. |\n" +
          "| `cancel` | status → `cancelled`, frees the courier. |\n" +
          "| `confirm-location` | Updates `deliveryLat/Lng` and sets `locationConfirmed=true`. |\n" +
          "| `confirm-pickup` | Updates `pickupLat/Lng` (and `pickupAddress`). |\n" +
          "| `update-price` | Sets `price`. |\n" +
          "| `update-priority` | Sets `priority`. |\n" +
          "| `update-notes` | Sets `notes`. |\n" +
          "| `acknowledge` | Fires a Pusher acknowledgement (no DB write). |\n",
        parameters: [{ $ref: "#/components/parameters/DeliveryId" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/DeliveryPatch" } } },
        },
        responses: {
          "200": { description: "Updated delivery.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Delivery" } } } },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      delete: {
        tags: ["Deliveries"],
        summary: "Delete a delivery",
        parameters: [{ $ref: "#/components/parameters/DeliveryId" }],
        responses: {
          "200": { description: "Deleted.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },

    // ── Couriers ───────────────────────────────────────────────────────────
    "/api/couriers": {
      get: {
        tags: ["Couriers"],
        summary: "List couriers (with stats)",
        description:
          "Returns every courier with their active deliveries, unresolved " +
          "alerts (max 5), all-time delivered count and today's delivered " +
          "count.",
        responses: {
          "200": { description: "Couriers.",
            content: { "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/CourierWithStats" } },
            } } },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      post: {
        tags: ["Couriers"],
        summary: "Create a courier",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CourierCreate" } } },
        },
        responses: {
          "201": { description: "Created.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Courier" } } } },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/api/couriers/{id}": {
      get: {
        tags: ["Couriers"],
        summary: "Get a courier",
        parameters: [{ $ref: "#/components/parameters/CourierId" }],
        responses: {
          "200": { description: "Courier with active deliveries and alerts.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CourierWithStats" } } } },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Couriers"],
        summary: "Update a courier",
        parameters: [{ $ref: "#/components/parameters/CourierId" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CourierUpdate" } } },
        },
        responses: {
          "200": { description: "Updated.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Courier" } } } },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
      delete: {
        tags: ["Couriers"],
        summary: "Delete a courier",
        description:
          "Detaches the courier from any pending deliveries (which are " +
          "reset to `pending`), removes their alerts and GPS history, then " +
          "deletes the courier record.",
        parameters: [{ $ref: "#/components/parameters/CourierId" }],
        responses: {
          "200": { description: "Deleted.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/couriers/{id}/stats": {
      get: {
        tags: ["Couriers", "Stats"],
        summary: "Per-courier statistics",
        description:
          "Aggregated metrics (today / week / month / all-time) plus the " +
          "courier's full delivery history. Revenue is computed from the " +
          "tariff `5 DT + 2 DT × priority`.",
        parameters: [{ $ref: "#/components/parameters/CourierId" }],
        responses: {
          "200": { description: "Stats.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/CourierStats" } } } },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ── Merchants ──────────────────────────────────────────────────────────
    "/api/merchants": {
      get: {
        tags: ["Merchants"],
        summary: "List active merchants",
        parameters: [
          { name: "category", in: "query",
            schema: { type: "string" },
            description: "Filter by category (use `all` to disable filter)." },
          { name: "search", in: "query",
            schema: { type: "string" },
            description: "Case-insensitive `contains` match on merchant name." },
        ],
        responses: {
          "200": { description: "Merchants.",
            content: { "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/Merchant" } },
            } } },
        },
      },
    },
    "/api/merchants/{id}": {
      get: {
        tags: ["Merchants"],
        summary: "Get a merchant",
        parameters: [{ $ref: "#/components/parameters/MerchantId" }],
        responses: {
          "200": { description: "Merchant.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Merchant" } } } },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Merchants"],
        summary: "Update a merchant",
        parameters: [{ $ref: "#/components/parameters/MerchantId" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/MerchantUpdate" } } },
        },
        responses: {
          "200": { description: "Updated.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Merchant" } } } },
        },
      },
      delete: {
        tags: ["Merchants"],
        summary: "Delete a merchant",
        parameters: [{ $ref: "#/components/parameters/MerchantId" }],
        responses: {
          "200": { description: "Deleted.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
        },
      },
    },

    // ── Tracking ───────────────────────────────────────────────────────────
    "/api/tracking": {
      post: {
        tags: ["Tracking"],
        summary: "Push a courier GPS ping",
        description:
          "Persists a `CourierLocation` row, updates `Courier.currentLat/Lng/" +
          "speed/heading/lastSeen`, and broadcasts `courier:location` on " +
          "`admin-channel`.\n\n" +
          "**Pause detection**: when a *busy* courier remains within 50 m " +
          "for ≥ 5 minutes, an `unauthorized_pause` alert is created " +
          "automatically (severity escalates to `critical` after 10 min). " +
          "Resumed motion auto-resolves the alert.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TrackingPing" } } },
        },
        responses: {
          "200": { description: "Ping accepted.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ── Public tracking ────────────────────────────────────────────────────
    "/api/track/{orderNumber}": {
      get: {
        tags: ["Public"],
        summary: "Public order tracking",
        description:
          "Customer-facing endpoint — **no authentication**. Returns the " +
          "delivery and a stripped courier object (no internal IDs beyond " +
          "what the customer needs to render the live map).",
        security: [],
        parameters: [{ $ref: "#/components/parameters/OrderNumber" }],
        responses: {
          "200": { description: "Delivery.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Delivery" } } } },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ── Alerts ─────────────────────────────────────────────────────────────
    "/api/alerts": {
      get: {
        tags: ["Alerts"],
        summary: "List alerts",
        description: "Most recent first, capped at 100.",
        parameters: [
          { name: "resolved", in: "query",
            schema: { type: "boolean" },
            description: "Filter on resolved/unresolved." },
          { name: "courierId", in: "query",
            schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Alerts.",
            content: { "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/Alert" } },
            } } },
        },
      },
    },
    "/api/alerts/{id}": {
      patch: {
        tags: ["Alerts"],
        summary: "Update / resolve an alert",
        description:
          "Setting `resolved: true` automatically populates `resolvedAt`. " +
          "Broadcasts `alerts:updated` on `admin-channel`.",
        parameters: [{ $ref: "#/components/parameters/AlertId" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AlertUpdate" } } },
        },
        responses: {
          "200": { description: "Updated.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Alert" } } } },
        },
      },
    },

    // ── Stats ──────────────────────────────────────────────────────────────
    "/api/stats": {
      get: {
        tags: ["Stats"],
        summary: "Dashboard counters",
        responses: {
          "200": { description: "Counters.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/DashboardStats" } } } },
        },
      },
    },

    // ── Admin ──────────────────────────────────────────────────────────────
    "/api/admin/seed-osm": {
      post: {
        tags: ["Admin"],
        summary: "Re-seed the merchant catalog from OpenStreetMap",
        description:
          "Fetches merchants from the Overpass API and upserts them by " +
          "`osmId`. Idempotent.",
        responses: {
          "200": { description: "Seed report.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SeedResponse" } } } },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },

    // ── Self ───────────────────────────────────────────────────────────────
    "/api/docs": {
      get: {
        tags: ["Admin"],
        summary: "OpenAPI specification (this document)",
        description: "Returns the raw OpenAPI 3.0 JSON document used by Swagger UI.",
        security: [],
        responses: {
          "200": { description: "OpenAPI document.",
            content: { "application/json": { schema: { type: "object" } } } },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
