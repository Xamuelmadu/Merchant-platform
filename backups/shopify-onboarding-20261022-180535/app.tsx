import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";

import {
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";

import {
  AppProvider,
} from "@shopify/shopify-app-react-router/react";

import {
  boundary,
} from "@shopify/shopify-app-react-router/server";

import {
  authenticate,
} from "../shopify.server";

import {
  getShopifyProducts,
} from "../services/shopify/products.server";

import {
  syncProductsToPlatform,
} from "../services/platform/products.server";

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

type AICommerceIdentity = {
  user_id?: string;
  store_id?: string;
  token?: string;
};

type ShopifyShop = {
  id: string;
  name: string;
  email?: string | null;
  myshopifyDomain: string;
  currencyCode: string;
  primaryDomain?: {
    host?: string | null;
    url?: string | null;
  } | null;
};

type IdentityResponse = {
  success?: boolean;
  authenticated?: boolean;
  user_id?: string;
  store_id?: string;
  token?: string;
  requires_account_creation?: boolean;
  requires_email_verification?: boolean;
  error?: string;
};

type HandoffResponse = {
  success?: boolean;
  code?: string;
  expires_in?: number;
  error?: string;
};

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

/**
 * Validate the optional dashboard return URL.
 *
 * Only HTTPS URLs are allowed in production.
 * Localhost is permitted for development.
 *
 * Only the Shopify callback path is permitted.
 */
function normalizeReturnUrl(
  request: Request,
): string | null {
  const requestUrl = new URL(request.url);

  const returnTo =
    requestUrl.searchParams.get("returnTo");

  if (!returnTo) {
    return null;
  }

  try {
    const parsed = new URL(returnTo);

    const isLocalhost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1";

    const isHttps =
      parsed.protocol === "https:";

    if (!isHttps && !isLocalhost) {
      console.warn(
        "Rejected non-HTTPS Shopify return URL:",
        returnTo,
      );

      return null;
    }

    if (
      parsed.pathname !==
      "/auth/shopify/callback"
    ) {
      console.warn(
        "Rejected invalid Shopify return path:",
        parsed.pathname,
      );

      return null;
    }

    if (
      parsed.username ||
      parsed.password
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    console.warn(
      "Invalid Shopify return URL:",
      returnTo,
    );

    return null;
  }
}

/**
 * Return the configured dashboard origin.
 *
 * GUAVA_DASHBOARD_URL and DASHBOARD_URL remain
 * supported for compatibility.
 */
function getDefaultDashboardUrl(): string {
  const dashboardUrl =
    process.env.GUAVA_DASHBOARD_URL ||
    process.env.DASHBOARD_URL ||
    "https://guavabyinvite.com";

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(dashboardUrl);
  } catch {
    throw new Error(
      "The configured dashboard URL is invalid.",
    );
  }

  const isLocalhost =
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "127.0.0.1";

  if (
    parsedUrl.protocol !== "https:" &&
    !isLocalhost
  ) {
    throw new Error(
      "The dashboard URL must use HTTPS in production.",
    );
  }

  if (
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(
      "The configured dashboard URL is invalid.",
    );
  }

  /*
   * Return only the origin.
   *
   * This prevents a configured URL such as
   * https://guavabyinvite.com/dashboard from
   * creating a nested callback path.
   */
  return parsedUrl.origin;
}

/**
 * Resolve the dashboard callback URL.
 */
function getShopifyReturnUrl(
  request: Request,
): string {
  const suppliedReturnUrl =
    normalizeReturnUrl(request);

  if (suppliedReturnUrl) {
    return suppliedReturnUrl;
  }

  const dashboardOrigin =
    getDefaultDashboardUrl();

  return `${dashboardOrigin}/auth/shopify/callback`;
}

/**
 * Create a short-lived, one-time handoff code
 * inside the Merchant Platform.
 *
 * The access token is sent server-to-server and
 * never placed in the browser URL.
 */
async function createShopifyHandoff(
  backendUrl: string,
  platformKey: string,
  identity: AICommerceIdentity,
  shop: ShopifyShop,
  returnUrl: string,
): Promise<HandoffResponse> {
  const response = await fetch(
    `${backendUrl}/api/auth/shopify/handoff`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-platform-key": platformKey,
      },

      body: JSON.stringify({
        user_id: identity.user_id,
        store_id: identity.store_id,
        token: identity.token,
        shop_id: shop.id,
        shop_domain: shop.myshopifyDomain,
        return_to: returnUrl,
      }),
    },
  );

  const responseText =
    await response.text();

  let data: HandoffResponse = {};

  try {
    data = JSON.parse(responseText);
  } catch {
    data = {};
  }

  if (!response.ok) {
    console.error(
      "Shopify handoff failed:",
      response.status,
      responseText,
    );

    throw new Response(
      "Unable to create Shopify login handoff.",
      { status: 502 },
    );
  }

  if (
    !data.success ||
    !data.code
  ) {
    console.error(
      "Shopify handoff returned an invalid response:",
      data,
    );

    throw new Response(
      "Invalid Shopify handoff response.",
      { status: 502 },
    );
  }

  return data;
}

/**
 * Validate a merchant identity returned by the
 * Merchant Platform.
 */
function hasCompleteMerchantIdentity(
  identity: IdentityResponse,
): identity is IdentityResponse & {
  user_id: string;
  store_id: string;
  token: string;
} {
  return Boolean(
    identity.success &&
    identity.authenticated !== false &&
    identity.user_id &&
    identity.store_id &&
    identity.token,
  );
}

/*
|--------------------------------------------------------------------------
| LOADER
|--------------------------------------------------------------------------
*/

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  /*
  |--------------------------------------------------------------------------
  | SHOPIFY AUTHENTICATION
  |--------------------------------------------------------------------------
  */

  const {
    admin,
    session,
  } = await authenticate.admin(request);

  /*
  |--------------------------------------------------------------------------
  | GET SHOP INFORMATION
  |--------------------------------------------------------------------------
  */

  const response = await admin.graphql(
    `#graphql
      query GetShopForGuava {
        shop {
          id
          name
          email
          myshopifyDomain
          currencyCode
          primaryDomain {
            host
            url
          }
        }
      }
    `,
  );

  const responseJson =
    await response.json();

  const shop =
    responseJson.data?.shop as
      | ShopifyShop
      | undefined;

  if (!shop) {
    throw new Response(
      "Unable to load Shopify store.",
      { status: 500 },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | BACKEND CONFIGURATION
  |--------------------------------------------------------------------------
  */

  const backendUrl =
    process.env.AI_COMMERCE_BACKEND_URL;

  const platformKey =
    process.env.AI_COMMERCE_PLATFORM_KEY;

  /*
  |--------------------------------------------------------------------------
  | DETECT DASHBOARD LOGIN
  |--------------------------------------------------------------------------
  */

  const requestUrl =
    new URL(request.url);

  const hasWebReturn =
    requestUrl.searchParams.has("returnTo");

  /*
   * The backend verifies this signed,
   * short-lived intent and resolves the
   * intended Guava account.
   *
   * Never trust an owner ID supplied
   * directly by the browser.
   */
  const connectionIntent =
    requestUrl.searchParams.get(
      "connection_intent",
    ) || undefined;

  /*
   * Only resolve a dashboard callback for a
   * dashboard-initiated login. Normal embedded
   * Shopify launches remain inside Shopify.
   */
  const returnUrl = hasWebReturn
    ? normalizeReturnUrl(request)
    : null;

  if (
    hasWebReturn &&
    !returnUrl
  ) {
    throw new Response(
      "Invalid Shopify dashboard return destination.",
      { status: 400 },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | IDENTITY
  |--------------------------------------------------------------------------
  */

  let aiCommerceIdentity:
    AICommerceIdentity | null = null;

  if (
    backendUrl &&
    platformKey
  ) {
    /*
    |--------------------------------------------------------------------------
    | IDENTIFY SHOPIFY MERCHANT
    |--------------------------------------------------------------------------
    */

    const identityResponse = await fetch(
      `${backendUrl}/api/auth/shopify/identify`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-platform-key": platformKey,
        },

        body: JSON.stringify({
          shop_id: shop.id,
          shop_domain: shop.myshopifyDomain,
          shop_name: shop.name,
          shop_email: shop.email || null,
          currency: shop.currencyCode,

          ...(connectionIntent
            ? {
                connection_intent:
                  connectionIntent,
              }
            : {}),
        }),
      },
    );

    const identityText =
      await identityResponse.text();

    let identityData:
      IdentityResponse = {};

    try {
      identityData =
        JSON.parse(identityText);
    } catch {
      identityData = {};
    }

    if (!identityResponse.ok) {
      console.error(
        "Shopify identity request failed:",
        identityResponse.status,
        identityText,
      );

      throw new Response(
        "Unable to establish Shopify merchant identity.",
        { status: 502 },
      );
    }

    /*
    |--------------------------------------------------------------------------
    | DASHBOARD LOGIN HANDOFF
    |--------------------------------------------------------------------------
    |
    | Only dashboard-initiated login receives
    | a one-time handoff code.
    |--------------------------------------------------------------------------
    */

    if (hasWebReturn) {
      /*
       * Do not create a login session for an
       * unregistered or unauthenticated merchant.
       */
      if (
        !hasCompleteMerchantIdentity(
          identityData,
        )
      ) {
        console.warn(
          "Shopify dashboard login requires a completed merchant account.",
          {
            requires_account_creation:
              identityData.requires_account_creation,

            requires_email_verification:
              identityData.requires_email_verification,
          },
        );

        throw new Response(
          identityData.requires_account_creation ||
          identityData.requires_email_verification
            ? "Complete Guava account registration and email verification before using Shopify login."
            : "Shopify merchant authentication is incomplete.",
          { status: 401 },
        );
      }

      aiCommerceIdentity = {
        user_id: identityData.user_id,
        store_id: identityData.store_id,
        token: identityData.token,
      };

      /*
      |--------------------------------------------------------------------------
      | CREATE ONE-TIME HANDOFF
      |--------------------------------------------------------------------------
      */

      const handoff =
        await createShopifyHandoff(
          backendUrl,
          platformKey,
          aiCommerceIdentity,
          shop,
          returnUrl!,
        );

      const callbackUrl =
        new URL(returnUrl!);

      callbackUrl.searchParams.set(
        "code",
        handoff.code!,
      );

      console.log(
        "Returning Shopify merchant to the Guava dashboard.",
        {
          store_id: identityData.store_id,
          shop_domain: shop.myshopifyDomain,
        },
      );

      /*
       * The browser receives only the temporary
       * code, never the access token.
       */
      throw new Response(null, {
        status: 302,

        headers: {
          Location:
            callbackUrl.toString(),
        },
      });
    }

    /*
    |--------------------------------------------------------------------------
    | NORMAL EMBEDDED SHOPIFY LAUNCH
    |--------------------------------------------------------------------------
    |
    | No dashboard handoff is created here.
    | Store connection and product synchronization
    | require a verified Guava identity.
    |--------------------------------------------------------------------------
    */

    if (
      !hasCompleteMerchantIdentity(
        identityData,
      )
    ) {
      const needsAccount =
        identityData.requires_account_creation ||
        identityData.requires_email_verification;

      console.warn(
        "Shopify store connection blocked until Guava identity is verified.",
        {
          shop_domain: shop.myshopifyDomain,

          requires_account_creation:
            identityData.requires_account_creation,

          requires_email_verification:
            identityData.requires_email_verification,

          connection_intent_supplied:
            Boolean(connectionIntent),
        },
      );

      /*
       * Never connect a store or sync its products
       * without a verified Guava identity.
       *
       * The Guava onboarding/return flow must
       * complete before the merchant retries.
       */
      throw new Response(
        needsAccount
          ? "Connect this Shopify store from Guava. Sign in or create and verify your Guava account, then retry the connection."
          : identityData.error ||
            "Unable to establish a verified Guava merchant identity.",
        {
          status: needsAccount
            ? 401
            : 502,
        },
      );
    }

    aiCommerceIdentity = {
      user_id: identityData.user_id,
      store_id: identityData.store_id,
      token: identityData.token,
    };

    /*
    |--------------------------------------------------------------------------
    | CONNECT SHOP
    |--------------------------------------------------------------------------
    |
    | Preserve the existing backend endpoint
    | and payload contract.
    |--------------------------------------------------------------------------
    */

    const connectResponse = await fetch(
      `${backendUrl}/api/integrations/shopify/connect`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-platform-key": platformKey,
        },

        body: JSON.stringify({
          shop_id: shop.id,
          shop_domain: shop.myshopifyDomain,
          shop_name: shop.name,
          shop_email: shop.email || null,
          access_token: session.accessToken,
          currency: shop.currencyCode,
        }),
      },
    );

    if (!connectResponse.ok) {
      const errorText =
        await connectResponse.text();

      console.error(
        "Shopify store connection failed:",
        connectResponse.status,
        errorText,
      );

      throw new Response(
        "Unable to connect this Shopify store.",
        { status: 502 },
      );
    }

    /*
    |--------------------------------------------------------------------------
    | INITIAL PRODUCT SYNC
    |--------------------------------------------------------------------------
    |
    | A product synchronization failure must not
    | prevent the merchant from opening Shopify.
    |--------------------------------------------------------------------------
    */

    try {
      console.log(
        "Loading Shopify products...",
      );

      const products =
        await getShopifyProducts(admin);

      console.log(
        `Shopify products loaded: ${products.length}`,
      );

      const syncResult =
        await syncProductsToPlatform({
          shop: shop.myshopifyDomain,
          products,
        });

      console.log(
        `Shopify catalog synced: ${syncResult.synced} products`,
      );
    } catch (error) {
      console.error(
        "Shopify product synchronization failed:",
        error,
      );
    }
  } else {
    console.error(
      "Guava backend configuration is missing.",
      {
        backendUrlConfigured:
          Boolean(backendUrl),

        platformKeyConfigured:
          Boolean(platformKey),
      },
    );

    throw new Response(
      "Shopify backend integration is not configured.",
      { status: 500 },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | RETURN APP DATA
  |--------------------------------------------------------------------------
  */

  return {
    apiKey:
      process.env.SHOPIFY_API_KEY || "",

    identity: {
      userId:
        aiCommerceIdentity?.user_id || null,

      storeId:
        aiCommerceIdentity?.store_id || null,

      token:
        aiCommerceIdentity?.token || null,
    },

    shop: {
      id: shop.id,
      name: shop.name,
      email: shop.email,

      myshopifyDomain:
        shop.myshopifyDomain,

      primaryDomain:
        shop.primaryDomain?.host || null,

      currencyCode:
        shop.currencyCode,
    },
  };
};

/*
|--------------------------------------------------------------------------
| APP
|--------------------------------------------------------------------------
*/

export default function App() {
  const {
    apiKey,
    identity,
    shop,
  } = useLoaderData<typeof loader>();

  return (
    <AppProvider
      embedded
      apiKey={apiKey}
    >
      <Outlet
        context={{
          identity,
          shop,
        }}
      />
    </AppProvider>
  );
}

/*
|--------------------------------------------------------------------------
| ERROR BOUNDARY
|--------------------------------------------------------------------------
*/

export function ErrorBoundary() {
  return boundary.error(
    useRouteError(),
  );
}

/*
|--------------------------------------------------------------------------
| HEADERS
|--------------------------------------------------------------------------
*/

export const headers: HeadersFunction = (
  headersArgs,
) => {
  return boundary.headers(
    headersArgs,
  );
};