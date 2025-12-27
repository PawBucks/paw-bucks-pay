import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  canonical?: string;
}

// SEO component for better search engine optimization
export const SEO = ({ 
  title, 
  description = "PawBucks - The payment platform for pet owners. Earn PawBucks rewards with every transaction.",
  keywords = ["pet", "payments", "PawBucks", "rewards", "pets", "animals"],
  ogImage = "/logo.png",
  canonical
}: SEOProps) => {
  useEffect(() => {
    // Update title
    document.title = `${title} | PawBucks`;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    // Standard meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords.join(', '));

    // Open Graph tags
    updateMetaTag('og:title', `${title} | PawBucks`, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:type', 'website', true);

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', `${title} | PawBucks`);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', ogImage);

    // Canonical URL
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonical);
    }

    return () => {
      // Cleanup (optional, usually not needed)
    };
  }, [title, description, keywords, ogImage, canonical]);

  return null;
};
