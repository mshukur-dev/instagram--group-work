import { redirect } from 'next/navigation';

// Explore lives on the search page (the Top grid); an old or typed /explore link lands there
export default function ExploreRoute() {
  redirect('/explore/search');
}
