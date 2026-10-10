// HOW TO WIRE THE HOME PAGE INTO YOUR OWN APP (copy the parts you need).
import { Route, Routes } from 'react-router-dom';
import HomePage from '../src/features/home/HomePage.jsx';
import VisitTracker from '../src/features/home/tracking/VisitTracker.jsx';
import AppLayout from '../src/optional-layout/AppLayout.jsx'; // only if you have no layout/sidebar yet

export default function App() {
  return (
    <>
      {/* 1. Counts website viewers for the "Digital access" tile. Mount once. */}
      <VisitTracker />

      <Routes>
        {/* 2a. Inside the optional sidebar layout ... */}
        <Route element={<AppLayout onSignOut={() => { /* call YOUR sign-out here */ }} />}>
          <Route index element={<HomePage />} />
        </Route>

        {/* 2b. ... or inside your own layout / protected route: */}
        {/* <Route path="/home" element={<HomePage searchPath="/search" />} /> */}
      </Routes>
    </>
  );
}
