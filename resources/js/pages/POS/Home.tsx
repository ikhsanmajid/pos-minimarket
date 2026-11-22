import React from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { useAuth } from '@/hooks/use-auth';

const Home = ({ }) => {
    const { user } = useAuth();

    return (
        <>
            {user.email}
        </>
    );

}

Home.layout = (page: React.ReactNode) => <AuthenticatedLayout>{page}</AuthenticatedLayout>

export default Home;
