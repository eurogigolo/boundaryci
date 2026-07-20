import {
  absoluteUrl,
  type PublicRouteMetadata,
  SITE_ORIGIN,
} from "../content/publicPages";

const organization = {
  "@type": "Organization",
  "@id": `${SITE_ORIGIN}/#organization`,
  name: "BoundaryCI",
  url: `${SITE_ORIGIN}/`,
  logo: `${SITE_ORIGIN}/favicon.png`,
  sameAs: [
    "https://github.com/sir-gig/boundaryci",
    "https://www.npmjs.com/package/boundaryci",
  ],
};

const website = {
  "@type": "WebSite",
  "@id": `${SITE_ORIGIN}/#website`,
  name: "BoundaryCI",
  url: `${SITE_ORIGIN}/`,
  publisher: { "@id": `${SITE_ORIGIN}/#organization` },
  inLanguage: "en-US",
};

const softwareApplication = {
  "@type": "SoftwareApplication",
  "@id": `${SITE_ORIGIN}/#software`,
  name: "BoundaryCI",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Windows, macOS, Linux",
  description: "Tenant-isolation security for Supabase and PostgreSQL with deterministic CI checks and optional managed AI review.",
  url: `${SITE_ORIGIN}/`,
  downloadUrl: "https://www.npmjs.com/package/boundaryci",
  codeRepository: "https://github.com/sir-gig/boundaryci",
  license: "https://opensource.org/license/mit",
  author: { "@id": `${SITE_ORIGIN}/#organization` },
  featureList: [
    "Deterministic Supabase and PostgreSQL migration checks",
    "Optional managed Fireworks AI tenant review",
    "Native GitHub pull-request annotations",
    "Repository-bound Cloud evidence and history",
  ],
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Team", price: "49", priceCurrency: "USD" },
    { "@type": "Offer", name: "Growth", price: "149", priceCurrency: "USD" },
  ],
};

function faqPageForRoute(route: PublicRouteMetadata): Record<string, unknown> | undefined {
  if (!route.faqs?.length) return undefined;

  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl(route.path)}#faq`,
    mainEntity: route.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

function breadcrumbItems(route: PublicRouteMetadata) {
  const items = [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
  ];

  if (route.kind === "rule") {
    items.push({ "@type": "ListItem", position: 2, name: "Rules", item: absoluteUrl("/rules/") });
  } else if (route.kind === "guide" && route.path !== "/guides/tenant-isolation-testing/") {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: "Guides",
      item: absoluteUrl("/guides/tenant-isolation-testing/"),
    });
  }

  items.push({
    "@type": "ListItem",
    position: items.length + 1,
    name: route.heading,
    item: absoluteUrl(route.path),
  });

  return items;
}

export function structuredDataForRoute(route: PublicRouteMetadata): Record<string, unknown> {
  const faqPage = faqPageForRoute(route);

  if (route.kind === "home") {
    return {
      "@context": "https://schema.org",
      "@graph": [organization, website, softwareApplication, ...(faqPage ? [faqPage] : [])],
    };
  }

  const pageUrl = absoluteUrl(route.path);
  const pageType = route.kind === "guide" || route.kind === "documentation" || route.kind === "rule"
    ? "TechArticle"
    : route.kind === "rule-index"
      ? "CollectionPage"
      : "WebPage";

  const page: Record<string, unknown> = {
    "@type": pageType,
    "@id": `${pageUrl}#page`,
    url: pageUrl,
    name: route.title,
    headline: route.heading,
    description: route.description,
    inLanguage: "en-US",
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    about: { "@id": `${SITE_ORIGIN}/#software` },
  };

  if (faqPage) page.hasPart = { "@id": `${pageUrl}#faq` };

  if (pageType === "TechArticle") {
    page.datePublished = route.publishedAt;
    page.dateModified = route.modifiedAt;
    page.author = { "@id": `${SITE_ORIGIN}/#organization` };
    page.publisher = { "@id": `${SITE_ORIGIN}/#organization` };
    page.mainEntityOfPage = { "@id": `${pageUrl}#page` };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      website,
      softwareApplication,
      page,
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumbs`,
        itemListElement: breadcrumbItems(route),
      },
      ...(faqPage ? [faqPage] : []),
    ],
  };
}
