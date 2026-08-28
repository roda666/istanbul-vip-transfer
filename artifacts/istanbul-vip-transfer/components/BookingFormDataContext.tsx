'use client';

import { createContext, useContext } from 'react';
import {
  EMPTY_BOOKING_FORM_BOOTSTRAP,
  type BookingFormBootstrap,
} from '@/lib/booking-form-types';

const BookingFormDataContext = createContext<BookingFormBootstrap>(EMPTY_BOOKING_FORM_BOOTSTRAP);

export function BookingFormDataProvider({
  data,
  children,
}: {
  data: BookingFormBootstrap;
  children: React.ReactNode;
}) {
  return (
    <BookingFormDataContext.Provider value={data}>
      {children}
    </BookingFormDataContext.Provider>
  );
}

export function useBookingFormData(): BookingFormBootstrap {
  return useContext(BookingFormDataContext);
}