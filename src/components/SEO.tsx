import { useEffect } from'react';

interface BreadcrumbItem {
 name: string;
 url: string;
}

interface SEOProps {
 title: string;
 description?: string;
 keywords?: string[];
 ogImage?: string;
 canonical?: string;
 type?:'website' |'article' |'product' |'profile';
 noIndex?: boolean;
 breadcrumbs?: BreadcrumbItem[];
 publishedTime?: string;
 modifiedTime?: string;
 author?: string;
 jsonLd?: object;
}

const BASE_URL ='https://pawbucks.app';

// SEO component for better search engine optimization
export const SEO = ({ 
 title, 
 description ="PawBucks - The payment platform for pet owners. Earn PawBucks rewards with every transaction at trusted pet merchants.",
 keywords = ["pet payments","PawBucks","pet rewards","pet wallet","pet stores","groomers","pet services","digital wallet"],
 ogImage ="/logo.png",
 canonical,
 type ='website',
 noIndex = false,
 breadcrumbs,
 publishedTime,
 modifiedTime,
 author,
 jsonLd
}: SEOProps) => {
 useEffect(() => {
 // Update title - keep under 60 characters for optimal display
 const fullTitle = title.length > 50 ? title : `${title} | PawBucks`;
 document.title = fullTitle;

 // Update or create meta tags
 const updateMetaTag = (name: string, content: string, isProperty = false) => {
 const attribute = isProperty ?'property' :'name';
 let element = document.querySelector(`meta[${attribute}="${name}"]`);
 
 if (!element) {
 element = document.createElement('meta');
 element.setAttribute(attribute, name);
 document.head.appendChild(element);
 }
 
 element.setAttribute('content', content);
 };

 const removeMetaTag = (name: string, isProperty = false) => {
 const attribute = isProperty ?'property' :'name';
 const element = document.querySelector(`meta[${attribute}="${name}"]`);
 if (element) {
 element.remove();
 }
 };

 // Robots meta tag
 if (noIndex) {
 updateMetaTag('robots','noindex, nofollow');
 } else {
 updateMetaTag('robots','index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
 }

 // Standard meta tags - description max 160 characters
 const truncatedDescription = description.length > 160 ? description.substring(0, 157) +'...' : description;
 updateMetaTag('description', truncatedDescription);
 updateMetaTag('keywords', keywords.join(','));
 
 // Additional SEO meta tags
 updateMetaTag('author', author ||'PawBucks');
 updateMetaTag('generator','Lovable');
 updateMetaTag('language','English');
 updateMetaTag('revisit-after','7 days');
 updateMetaTag('distribution','global');
 updateMetaTag('rating','general');

 // Geo targeting (US-focused)
 updateMetaTag('geo.region','US');
 updateMetaTag('geo.placename','United States');

 // Open Graph tags
 updateMetaTag('og:title', fullTitle, true);
 updateMetaTag('og:description', truncatedDescription, true);
 updateMetaTag('og:image', ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`, true);
 updateMetaTag('og:image:alt', `${title} - PawBucks`, true);
 updateMetaTag('og:image:width','1200', true);
 updateMetaTag('og:image:height','630', true);
 updateMetaTag('og:type', type, true);
 updateMetaTag('og:site_name','PawBucks', true);
 updateMetaTag('og:locale','en_US', true);
 
 const currentUrl = canonical || window.location.href;
 updateMetaTag('og:url', currentUrl.startsWith('http') ? currentUrl : `${BASE_URL}${currentUrl}`, true);

 // Article-specific Open Graph tags
 if (type ==='article') {
 if (publishedTime) updateMetaTag('article:published_time', publishedTime, true);
 if (modifiedTime) updateMetaTag('article:modified_time', modifiedTime, true);
 if (author) updateMetaTag('article:author', author, true);
 } else {
 removeMetaTag('article:published_time', true);
 removeMetaTag('article:modified_time', true);
 removeMetaTag('article:author', true);
 }

 // Twitter Card tags
 updateMetaTag('twitter:card','summary_large_image');
 updateMetaTag('twitter:title', fullTitle);
 updateMetaTag('twitter:description', truncatedDescription);
 updateMetaTag('twitter:image', ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`);
 updateMetaTag('twitter:image:alt', `${title} - PawBucks`);
 updateMetaTag('twitter:site','@PawBucks');
 updateMetaTag('twitter:creator','@PawBucks');

 // Canonical URL
 let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
 if (!link) {
 link = document.createElement('link');
 link.setAttribute('rel','canonical');
 document.head.appendChild(link);
 }
 const canonicalUrl = canonical || window.location.pathname;
 link.setAttribute('href', canonicalUrl.startsWith('http') ? canonicalUrl : `${BASE_URL}${canonicalUrl}`);

 // Breadcrumb JSON-LD
 if (breadcrumbs && breadcrumbs.length > 0) {
 let breadcrumbScript = document.querySelector('script[data-type="breadcrumb-jsonld"]');
 if (!breadcrumbScript) {
 breadcrumbScript = document.createElement('script');
 breadcrumbScript.setAttribute('type','application/ld+json');
 breadcrumbScript.setAttribute('data-type','breadcrumb-jsonld');
 document.head.appendChild(breadcrumbScript);
 }
 
 const breadcrumbData = {
"@context":"https://schema.org",
"@type":"BreadcrumbList",
"itemListElement": breadcrumbs.map((item, index) => ({
"@type":"ListItem",
"position": index + 1,
"name": item.name,
"item": item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`
 }))
 };
 breadcrumbScript.textContent = JSON.stringify(breadcrumbData);
 }

 // Custom JSON-LD
 if (jsonLd) {
 let customScript = document.querySelector('script[data-type="custom-jsonld"]');
 if (!customScript) {
 customScript = document.createElement('script');
 customScript.setAttribute('type','application/ld+json');
 customScript.setAttribute('data-type','custom-jsonld');
 document.head.appendChild(customScript);
 }
 customScript.textContent = JSON.stringify(jsonLd);
 }

 return () => {
 // Cleanup dynamic scripts on unmount
 const breadcrumbScript = document.querySelector('script[data-type="breadcrumb-jsonld"]');
 if (breadcrumbScript) breadcrumbScript.remove();
 const customScript = document.querySelector('script[data-type="custom-jsonld"]');
 if (customScript) customScript.remove();
 };
 }, [title, description, keywords, ogImage, canonical, type, noIndex, breadcrumbs, publishedTime, modifiedTime, author, jsonLd]);

 return null;
};

// Pre-built JSON-LD schemas for common use cases
export const createOrganizationSchema = () => ({
"@context":"https://schema.org",
"@type":"Organization",
"name":"PawBucks",
"url": BASE_URL,
"logo": `${BASE_URL}/logo.png`,
"description":"Digital payment platform for pet services with PawBucks rewards",
"sameAs": [
"https://twitter.com/PawBucks",
"https://facebook.com/PawBucks",
"https://instagram.com/PawBucks"
 ],
"contactPoint": {
"@type":"ContactPoint",
"contactType":"customer service",
"availableLanguage":"English"
 }
});

export const createLocalBusinessSchema = (merchant: {
 name: string;
 description?: string;
 address?: string;
 phone?: string;
 rating?: number;
 reviewCount?: number;
 priceRange?: string;
 image?: string;
}) => ({
"@context":"https://schema.org",
"@type":"LocalBusiness",
"name": merchant.name,
"description": merchant.description,
"address": merchant.address ? {
"@type":"PostalAddress",
"streetAddress": merchant.address
 } : undefined,
"telephone": merchant.phone,
"image": merchant.image,
"priceRange": merchant.priceRange ||"$$",
 ...(merchant.rating && merchant.reviewCount ? {
"aggregateRating": {
"@type":"AggregateRating",
"ratingValue": merchant.rating,
"reviewCount": merchant.reviewCount
 }
 } : {})
});

export const createFAQSchema = (faqs: { question: string; answer: string }[]) => ({
"@context":"https://schema.org",
"@type":"FAQPage",
"mainEntity": faqs.map(faq => ({
"@type":"Question",
"name": faq.question,
"acceptedAnswer": {
"@type":"Answer",
"text": faq.answer
 }
 }))
});

export const createProductSchema = (product: {
 name: string;
 description: string;
 price: number;
 currency?: string;
 image?: string;
 rating?: number;
 reviewCount?: number;
}) => ({
"@context":"https://schema.org",
"@type":"Product",
"name": product.name,
"description": product.description,
"image": product.image,
"offers": {
"@type":"Offer",
"price": product.price,
"priceCurrency": product.currency ||"USD",
"availability":"https://schema.org/InStock"
 },
 ...(product.rating && product.reviewCount ? {
"aggregateRating": {
"@type":"AggregateRating",
"ratingValue": product.rating,
"reviewCount": product.reviewCount
 }
 } : {})
});
