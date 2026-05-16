import { useLocation, Link } from"react-router-dom";
import { useEffect } from"react";
import { SEO } from"@/components/SEO";

const NotFound = () => {
 const location = useLocation();

 useEffect(() => {
 console.error("404 Error: User attempted to access non-existent route:", location.pathname);
 }, [location.pathname]);

 return (
 <>
 <SEO 
 title="Page Not Found"
 description="The page you're looking for doesn't exist. Return to PawBucks homepage to explore our digital pet payment platform and PawBucks rewards."
 />
 <div className="flex min-h-screen items-center justify-center bg-background">
 <div className="text-center">
 <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
 <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
 <Link to="/home" className="text-primary underline hover:text-primary/80">
 Return to Dashboard
 </Link>
 </div>
 </div>
 </>
 );
};

export default NotFound;
