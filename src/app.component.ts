import { Component, ChangeDetectionStrategy, signal, computed, LOCALE_ID, OnInit, inject } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeHr from '@angular/common/locales/hr';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';

// Register Croatian locale data for number and date formatting
registerLocaleData(localeHr, 'hr');

// Declare the libraries loaded via script tags
declare var jspdf: any;
declare var html2canvas: any;

interface Host {
  name: string;
  address: string;
  oib: string;
  legalStatus: string;
  iban: string;
  bank: string;
}

interface Guest {
  name: string;
  country: string;
  phone: string;
  email: string;
}

interface Reservation {
  arrival: Date;
  departure: Date;
  nights: number;
  apartment: string;
  pricePerNight: number;
  touristTaxPerPersonPerNight: number;
  cleaningFee: number;
  adults: number;
  prepayment: number;
}

interface Invoice {
  number: string;
  issueDate: Date;
  dueDate: Date;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [{ provide: LOCALE_ID, useValue: 'hr' }]
})
export class AppComponent implements OnInit {
  private fb = inject(FormBuilder);
  invoiceForm!: FormGroup;

  host = signal<Host>({
    name: 'Apartmani Sunce',
    address: 'Jadranska Cesta 123, 21300 Makarska, Croatia',
    oib: '12345678901',
    legalStatus: 'Privatni iznajmljivač van sustava PDV-a',
    iban: 'HR1234567890123456789',
    bank: 'Hrvatska Poštanska Banka d.d.',
  });

  guest = signal<Guest>({
    name: 'Mr. Klaus Schmidt',
    country: 'Germany',
    phone: '+49 123 456789',
    email: 'klaus.schmidt@email.de',
  });

  reservation = signal<Reservation>({
    arrival: new Date('2024-09-01'),
    departure: new Date('2024-09-08'),
    nights: 7,
    apartment: 'Sea View Apartment',
    pricePerNight: 120,
    touristTaxPerPersonPerNight: 1.50,
    cleaningFee: 50,
    adults: 2,
    prepayment: 200,
  });

  invoice = signal<Invoice>({
    number: `2024-${this.getInvoiceSequence()}`,
    issueDate: new Date(),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 7)), // Due in 7 days
  });

  accommodationCost = computed(() => this.reservation().nights * this.reservation().pricePerNight);
  touristTaxTotal = computed(() => this.reservation().nights * this.reservation().adults * this.reservation().touristTaxPerPersonPerNight);
  totalAmount = computed(() => this.accommodationCost() + this.touristTaxTotal() + this.reservation().cleaningFee);
  balanceDue = computed(() => this.totalAmount() - this.reservation().prepayment);

  ngOnInit(): void {
    const currentHost = this.host();
    const currentGuest = this.guest();
    const currentReservation = this.reservation();
    const currentInvoice = this.invoice();

    this.invoiceForm = this.fb.group({
      host: this.fb.group({
        name: [currentHost.name],
        address: [currentHost.address],
        oib: [currentHost.oib],
        legalStatus: [currentHost.legalStatus],
        iban: [currentHost.iban],
        bank: [currentHost.bank],
      }),
      guest: this.fb.group({
        name: [currentGuest.name],
        country: [currentGuest.country],
        phone: [currentGuest.phone],
        email: [currentGuest.email],
      }),
      reservation: this.fb.group({
        arrival: [this.formatDateForInput(currentReservation.arrival)],
        departure: [this.formatDateForInput(currentReservation.departure)],
        apartment: [currentReservation.apartment],
        pricePerNight: [currentReservation.pricePerNight],
        touristTaxPerPersonPerNight: [currentReservation.touristTaxPerPersonPerNight],
        cleaningFee: [currentReservation.cleaningFee],
        adults: [currentReservation.adults],
        prepayment: [currentReservation.prepayment],
      }),
      invoice: this.fb.group({
        number: [currentInvoice.number],
        issueDate: [this.formatDateForInput(currentInvoice.issueDate)],
        dueDate: [this.formatDateForInput(currentInvoice.dueDate)],
      }),
    });

    this.invoiceForm.valueChanges.subscribe(value => {
      if (this.invoiceForm.valid) {
        this.host.set(value.host);
        this.guest.set(value.guest);

        const arrival = new Date(value.reservation.arrival + 'T00:00:00');
        const departure = new Date(value.reservation.departure + 'T00:00:00');
        const nights = this.calculateNights(arrival, departure);

        this.reservation.set({
          ...value.reservation,
          arrival,
          departure,
          nights,
          pricePerNight: Number(value.reservation.pricePerNight) || 0,
          touristTaxPerPersonPerNight: Number(value.reservation.touristTaxPerPersonPerNight) || 0,
          cleaningFee: Number(value.reservation.cleaningFee) || 0,
          adults: Number(value.reservation.adults) || 0,
          prepayment: Number(value.reservation.prepayment) || 0,
        });

        this.invoice.set({
            ...value.invoice,
            issueDate: new Date(value.invoice.issueDate + 'T00:00:00'),
            dueDate: new Date(value.invoice.dueDate + 'T00:00:00'),
        });
      }
    });
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private calculateNights(arrival: Date, departure: Date): number {
    if (arrival && departure && arrival.getTime() < departure.getTime()) {
      const diffTime = Math.abs(departure.getTime() - arrival.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return 0;
  }

  private getInvoiceSequence(): string {
    // In a real app, this would come from a database or service.
    return '001';
  }

  printInvoice(): void {
    window.print();
  }

  exportAsPDF(): void {
    const invoicePreviewElement = document.getElementById('invoice-preview');
    if (invoicePreviewElement) {
      const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
      
      pdf.html(invoicePreviewElement, {
        callback: (doc: any) => {
          doc.save(`racun-${this.invoice().number}.pdf`);
        },
        margin: [15, 15, 15, 15],
        autoPaging: 'slice',
        width: 180,
        windowWidth: invoicePreviewElement.scrollWidth,
        fontFaces: [
          {
            family: 'Noto Sans',
            style: 'normal',
            weight: 'normal',
            src: [
              { url: 'https://fonts.gstatic.com/s/notosans/v27/o-0IIpQlx3QUlC5A4PNr6DRASf6M7VBj.woff2', format: 'woff2' }
            ]
          },
          {
            family: 'Noto Sans',
            style: 'normal',
            weight: 'bold',
            src: [
              { url: 'https://fonts.gstatic.com/s/notosans/v27/o-0NIpQlx3QUlC5A4PNjXhFVadyB1Wk_aA.woff2', format: 'woff2' }
            ]
          }
        ]
      });
    }
  }
}