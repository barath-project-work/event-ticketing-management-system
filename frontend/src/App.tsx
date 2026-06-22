import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ToastContainer from './components/Toast';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Reservations from './pages/Reservations';
import AdminDashboard from './pages/AdminDashboard';
import AdminCreateEvent from './pages/AdminCreateEvent';
import AdminManageEvent from './pages/AdminManageEvent';

export default function App() {
  return (
    <>
      <ToastContainer />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/events/create" element={<AdminCreateEvent />} />
          <Route path="/admin/events/:id" element={<AdminManageEvent />} />
        </Routes>
      </Layout>
    </>
  );
}
