import Stripe from "npm:stripe@22.3.2";

const APP_NAME = "BoundaryCI";
const DEFAULT_APP_URL = "https://boundaryci.com";
const MANAGED_CONFIGURATION = "boundaryci";
type BillingMode = "test" | "live";

function selectedBillingMode(): BillingMode {
  const supportedArguments = new Set(["--test", "--live"]);
  const unknownArgument = Deno.args.find((argument) =>
    !supportedArguments.has(argument)
  );
  if (unknownArgument) throw new Error(`Unknown argument: ${unknownArgument}`);
  if (Deno.args.includes("--test") && Deno.args.includes("--live")) {
    throw new Error("Choose either --test or --live, not both.");
  }
  return Deno.args.includes("--live") ? "live" : "test";
}

function applicationUrl(): string {
  const raw = Deno.env.get("BOUNDARYCI_APP_URL")?.trim() || DEFAULT_APP_URL;
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error(
      "BOUNDARYCI_APP_URL must use HTTPS outside local development.",
    );
  }
  return parsed.toString().replace(/\/$/, "");
}

interface ExpectedPrice {
  environmentName: string;
  label: string;
  unitAmount: number;
  interval: "month" | "year";
  productGroup: "team" | "growth";
}

const EXPECTED_PRICES: ExpectedPrice[] = [
  {
    environmentName: "STRIPE_PRICE_TEAM_MONTHLY",
    label: "Team monthly",
    unitAmount: 4_900,
    interval: "month",
    productGroup: "team",
  },
  {
    environmentName: "STRIPE_PRICE_TEAM_ANNUAL",
    label: "Team annual",
    unitAmount: 49_000,
    interval: "year",
    productGroup: "team",
  },
  {
    environmentName: "STRIPE_PRICE_GROWTH_MONTHLY",
    label: "Growth monthly",
    unitAmount: 14_900,
    interval: "month",
    productGroup: "growth",
  },
  {
    environmentName: "STRIPE_PRICE_GROWTH_ANNUAL",
    label: "Growth annual",
    unitAmount: 149_000,
    interval: "year",
    productGroup: "growth",
  },
];

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value || value.includes("replace_me")) {
    throw new Error(`${name} is missing or still contains a placeholder.`);
  }
  return value;
}

function productId(price: Stripe.Price): string {
  if (typeof price.product !== "string") {
    throw new Error(`Price ${price.id} did not return a product ID.`);
  }
  return price.product;
}

function validatePrice(
  price: Stripe.Price,
  expected: ExpectedPrice,
  billingMode: BillingMode,
): void {
  const problems: string[] = [];
  if (!price.active) problems.push("it is inactive");
  if (price.livemode !== (billingMode === "live")) {
    problems.push(`it is not a ${billingMode}-mode price`);
  }
  if (price.type !== "recurring") problems.push("it is not recurring");
  if (price.currency.toLowerCase() !== "usd") {
    problems.push("currency is not USD");
  }
  if (price.unit_amount !== expected.unitAmount) {
    problems.push(
      `amount is ${
        price.unit_amount ?? "unset"
      } cents instead of ${expected.unitAmount}`,
    );
  }
  if (price.recurring?.interval !== expected.interval) {
    problems.push(
      `interval is ${
        price.recurring?.interval ?? "unset"
      } instead of ${expected.interval}`,
    );
  }
  if (price.recurring?.interval_count !== 1) {
    problems.push("interval count is not 1");
  }
  if (problems.length > 0) {
    throw new Error(`${expected.label} is invalid: ${problems.join("; ")}.`);
  }
}

const billingMode = selectedBillingMode();
const appUrl = applicationUrl();
const secretKey = requiredEnvironment("STRIPE_SECRET_KEY");
const expectedKeyPrefix = billingMode === "live" ? "sk_live_" : "sk_test_";
if (!secretKey.startsWith(expectedKeyPrefix)) {
  throw new Error(
    `The ${billingMode}-mode setup requires a ${expectedKeyPrefix}... Stripe secret key.`,
  );
}
if (!requiredEnvironment("STRIPE_WEBHOOK_SECRET").startsWith("whsec_")) {
  throw new Error("STRIPE_WEBHOOK_SECRET must start with whsec_.");
}

const stripe = new Stripe(secretKey, {
  httpClient: Stripe.createFetchHttpClient(),
  maxNetworkRetries: 2,
});

if (billingMode === "live") {
  const account = await stripe.accounts.retrieve(null);
  if (!account.details_submitted || !account.charges_enabled) {
    throw new Error(
      "The Stripe account must finish business verification and enable live charges first.",
    );
  }
  if (!account.payouts_enabled) {
    console.warn(
      "  NOTE  Live payouts are not enabled yet. Review the Stripe account status.",
    );
  }
}

console.log(`Validating BoundaryCI ${billingMode}-mode prices...`);
const resolvedPrices = await Promise.all(
  EXPECTED_PRICES.map(async (expected) => {
    const id = requiredEnvironment(expected.environmentName);
    if (!id.startsWith("price_")) {
      throw new Error(
        `${expected.environmentName} must contain a Stripe price ID.`,
      );
    }
    const price = await stripe.prices.retrieve(id);
    validatePrice(price, expected, billingMode);
    console.log(
      `  OK  ${expected.label}: $${
        (expected.unitAmount / 100).toFixed(2)
      }/${expected.interval}`,
    );
    return { expected, price };
  }),
);

const teamPrices = resolvedPrices.filter(
  ({ expected }) => expected.productGroup === "team",
);
const growthPrices = resolvedPrices.filter(
  ({ expected }) => expected.productGroup === "growth",
);
const teamProduct = productId(teamPrices[0].price);
const growthProduct = productId(growthPrices[0].price);

if (teamPrices.some(({ price }) => productId(price) !== teamProduct)) {
  throw new Error(
    "The Team monthly and annual prices must share one Stripe product.",
  );
}
if (growthPrices.some(({ price }) => productId(price) !== growthProduct)) {
  throw new Error(
    "The Growth monthly and annual prices must share one Stripe product.",
  );
}
if (teamProduct === growthProduct) {
  throw new Error("Team and Growth must be separate Stripe products.");
}

const unspecifiedTaxPrices = resolvedPrices.filter(
  ({ price }) => price.tax_behavior === "unspecified",
);
if (unspecifiedTaxPrices.length > 0) {
  console.warn(
    billingMode === "live"
      ? "  NOTE  Stripe tax behavior is unspecified on one or more live prices. Decide and configure your tax treatment before taking customer payments."
      : "  NOTE  Stripe tax behavior is unspecified on one or more prices. This is fine for the first test checkout; set it consistently before enabling automatic tax.",
  );
}

const configurationParameters: Stripe.BillingPortal.ConfigurationCreateParams =
  {
    name: APP_NAME,
    metadata: {
      managed_by: MANAGED_CONFIGURATION,
    },
    default_return_url: `${appUrl}/?billing=portal`,
    business_profile: {
      headline: "Manage your BoundaryCI plan, payment method, and invoices.",
      privacy_policy_url: `${appUrl}/privacy/`,
      terms_of_service_url: `${appUrl}/terms/`,
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["name", "address", "tax_id"],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: {
          enabled: true,
          options: [
            "missing_features",
            "too_expensive",
            "unused",
            "switched_service",
            "other",
          ],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: [
          {
            product: teamProduct,
            prices: teamPrices.map(({ price }) => price.id),
          },
          {
            product: growthProduct,
            prices: growthPrices.map(({ price }) => price.id),
          },
        ],
      },
    },
  };

console.log("Configuring the BoundaryCI customer portal...");
const configurations = await stripe.billingPortal.configurations.list({
  active: true,
  limit: 100,
});
const existing = configurations.data.find(
  (configuration) =>
    configuration.metadata?.managed_by === MANAGED_CONFIGURATION ||
    configuration.name === APP_NAME,
);

const configuration = existing
  ? await stripe.billingPortal.configurations.update(
    existing.id,
    configurationParameters,
  )
  : await stripe.billingPortal.configurations.create(configurationParameters);

console.log(
  `  OK  ${existing ? "Updated" : "Created"} ${APP_NAME} portal configuration.`,
);
console.log(`STRIPE_PORTAL_CONFIGURATION_ID=${configuration.id}`);
console.log(
  billingMode === "live"
    ? "Stripe live billing is ready. Upload these live secrets before accepting payments."
    : "Stripe test billing is ready for a checkout smoke test.",
);
