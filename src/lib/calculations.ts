import {
  bookingAppliesToPeriod,
  getBookingShareInPeriod,
} from "./booking-allocation";
import { FISCAL_YEAR, MONTH_LABELS } from "./constants";
import type {
  Booking,
  Expense,
  ExpenseCategory,
  MonthPeriod,
  Platform,
  Property,
} from "./types";

export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(value: string): string {
  return parseDate(value).toLocaleDateString("it-IT");
}

export function getBookingNights(booking: Booking): number {
  const start = parseDate(booking.checkIn);
  const end = parseDate(booking.checkOut);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(diff, 0);
}

export function getBookingTotal(booking: Booking): number {
  return booking.grossIncome + booking.cleaningFee;
}

export function getBookingNetIncome(booking: Booking): number {
  return booking.grossIncome - (booking.otaCommission ?? 0);
}

export function getPeriodFromDate(value: string): MonthPeriod {
  const date = parseDate(value);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function periodKey(period: MonthPeriod): string {
  return `${period.year}-${period.month}`;
}

export function isInFiscalYear(period: MonthPeriod): boolean {
  return period.year === FISCAL_YEAR;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function getFiscalMonths(): MonthPeriod[] {
  return Array.from({ length: 12 }, (_, index) => ({
    year: FISCAL_YEAR,
    month: index + 1,
  }));
}

/** Mesi FY già trascorsi (1–12). Prima dell'anno fiscale → 0, dopo → 12. */
export function getElapsedFiscalMonth(referenceDate = new Date()): number {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;

  if (year < FISCAL_YEAR) {
    return 0;
  }

  if (year > FISCAL_YEAR) {
    return 12;
  }

  return month;
}

export function getMonthLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? `Mese ${month}`;
}

export function sumBookings(
  bookings: Booking[],
  filter?: (booking: Booking) => boolean,
): number {
  return bookings
    .filter((booking) => (filter ? filter(booking) : true))
    .reduce((total, booking) => total + getBookingTotal(booking), 0);
}

export function sumBookingsInPeriod(
  bookings: Booking[],
  period: MonthPeriod,
  filter?: (booking: Booking) => boolean,
): number {
  return bookings
    .filter((booking) => (filter ? filter(booking) : true))
    .reduce(
      (total, booking) =>
        total + getBookingTotal(booking) * getBookingShareInPeriod(booking, period),
      0,
    );
}

export function sumExpenses(
  expenses: Expense[],
  filter?: (expense: Expense) => boolean,
): number {
  return expenses
    .filter((expense) => (filter ? filter(expense) : true))
    .reduce((total, expense) => total + expense.amount, 0);
}

export function filterBookingsByPeriod(
  bookings: Booking[],
  period: MonthPeriod,
): Booking[] {
  return bookings.filter((booking) => bookingAppliesToPeriod(booking, period));
}

export function filterExpensesByPeriod(
  expenses: Expense[],
  period: MonthPeriod,
): Expense[] {
  return expenses.filter((expense) => {
    const expensePeriod = getPeriodFromDate(expense.date);
    return (
      expensePeriod.year === period.year &&
      expensePeriod.month === period.month
    );
  });
}

export function getProfitTarget(
  profitTargets: number[],
  month: number,
): number {
  return profitTargets[month - 1] ?? 0;
}

export function getMonthlySummaries(
  bookings: Booking[],
  expenses: Expense[],
  profitTargets: number[] = [],
) {
  return getFiscalMonths().map((period) => {
    const monthBookings = filterBookingsByPeriod(bookings, period);
    const monthExpenses = filterExpensesByPeriod(expenses, period);
    const income = sumBookingsInPeriod(bookings, period);
    const expenseTotal = sumExpenses(monthExpenses);
    const profit = income - expenseTotal;
    const target = getProfitTarget(profitTargets, period.month);

    return {
      period,
      label: getMonthLabel(period.month),
      income,
      expenses: expenseTotal,
      profit,
      margin: income > 0 ? profit / income : 0,
      bookingCount: monthBookings.length,
      expenseCount: monthExpenses.length,
      target,
      targetGap: profit - target,
      targetMet: target > 0 ? profit >= target : null,
    };
  });
}

export function getAnnualSummary(
  bookings: Booking[],
  expenses: Expense[],
  profitTargets: number[] = [],
) {
  const fiscalExpenses = expenses.filter((expense) =>
    isInFiscalYear(getPeriodFromDate(expense.date)),
  );

  const income = getFiscalMonths().reduce(
    (total, period) => total + sumBookingsInPeriod(bookings, period),
    0,
  );
  const expenseTotal = sumExpenses(fiscalExpenses);
  const profit = income - expenseTotal;
  const months = getMonthlySummaries(bookings, fiscalExpenses, profitTargets);
  const monthsWithData = months.filter(
    (month) => month.income > 0 || month.expenses > 0,
  ).length;
  const totalTarget = profitTargets.reduce((sum, value) => sum + value, 0);

  const elapsedMonths = getElapsedFiscalMonth();
  const ytdMonths = months.slice(0, elapsedMonths);
  const ytdIncome = ytdMonths.reduce((sum, month) => sum + month.income, 0);
  const ytdExpenses = ytdMonths.reduce((sum, month) => sum + month.expenses, 0);
  const ytdProfit = ytdIncome - ytdExpenses;
  const ytdTarget = profitTargets
    .slice(0, elapsedMonths)
    .reduce((sum, value) => sum + value, 0);
  const projectedProfit =
    elapsedMonths > 0 ? (ytdProfit / elapsedMonths) * 12 : profit;
  const projectedIncome =
    elapsedMonths > 0 ? (ytdIncome / elapsedMonths) * 12 : income;
  const projectedExpenses =
    elapsedMonths > 0 ? (ytdExpenses / elapsedMonths) * 12 : expenseTotal;

  return {
    income,
    expenses: expenseTotal,
    profit,
    margin: income > 0 ? profit / income : 0,
    avgMonthlyProfit: profit / 12,
    avgMonthlyIncome: income / 12,
    avgMonthlyExpenses: expenseTotal / 12,
    monthsWithData,
    totalTarget,
    targetGap: profit - totalTarget,
    elapsedMonths,
    ytdIncome,
    ytdExpenses,
    ytdProfit,
    ytdTarget,
    ytdTargetGap: ytdProfit - ytdTarget,
    projectedProfit,
    projectedIncome,
    projectedExpenses,
    projectedTargetGap: projectedProfit - totalTarget,
    nights: bookings.reduce(
      (total, booking) => total + getBookingNights(booking),
      0,
    ),
  };
}

export function groupBookingsByPlatform(
  bookings: Booking[],
  platforms: Platform[],
  period?: MonthPeriod,
) {
  return platforms
    .map((platform) => ({
      id: platform.id,
      name: platform.name,
      total: period
        ? sumBookingsInPeriod(
            bookings,
            period,
            (booking) => booking.platformId === platform.id,
          )
        : sumBookings(
            bookings,
            (booking) => booking.platformId === platform.id,
          ),
    }))
    .filter((item) => item.total > 0);
}

export function groupBookingsByProperty(
  bookings: Booking[],
  properties: Property[],
  period?: MonthPeriod,
) {
  return properties
    .map((property) => ({
      id: property.id,
      name: property.name,
      total: period
        ? sumBookingsInPeriod(
            bookings,
            period,
            (booking) => booking.propertyId === property.id,
          )
        : sumBookings(
            bookings,
            (booking) => booking.propertyId === property.id,
          ),
    }))
    .filter((item) => item.total > 0);
}

export function groupExpensesByCategory(
  expenses: Expense[],
  categories: ExpenseCategory[],
) {
  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      total: sumExpenses(
        expenses,
        (expense) => expense.categoryId === category.id,
      ),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function groupExpensesByProperty(
  expenses: Expense[],
  properties: Property[],
) {
  return properties
    .map((property) => ({
      id: property.id,
      name: property.name,
      total: sumExpenses(
        expenses,
        (expense) => expense.propertyId === property.id,
      ),
    }))
    .filter((item) => item.total > 0);
}

export function getPropertySummary(
  propertyId: string,
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  categories: ExpenseCategory[],
  platforms: Platform[],
) {
  const property = properties.find((item) => item.id === propertyId);
  const propertyBookings = bookings.filter(
    (booking) => booking.propertyId === propertyId,
  );
  const propertyExpenses = expenses.filter(
    (expense) => expense.propertyId === propertyId,
  );

  const income = getFiscalMonths().reduce(
    (total, period) => total + sumBookingsInPeriod(propertyBookings, period),
    0,
  );
  const expenseTotal = sumExpenses(propertyExpenses);
  const profit = income - expenseTotal;

  return {
    property,
    income,
    expenses: expenseTotal,
    profit,
    margin: income > 0 ? profit / income : 0,
    monthlyAverage: profit / 12,
    rate:
      property && property.monthlyRent > 0
        ? profit / property.monthlyRent
        : 0,
    monthly: getFiscalMonths().map((period) => {
      const monthExpenses = filterExpensesByPeriod(propertyExpenses, period);
      const monthIncome = sumBookingsInPeriod(propertyBookings, period);
      const monthExpenseTotal = sumExpenses(monthExpenses);

      return {
        period,
        label: getMonthLabel(period.month),
        income: monthIncome,
        expenses: monthExpenseTotal,
        profit: monthIncome - monthExpenseTotal,
      };
    }),
    platforms: platforms
      .map((platform) => ({
        id: platform.id,
        name: platform.name,
        total: getFiscalMonths().reduce(
          (total, period) =>
            total +
            sumBookingsInPeriod(
              propertyBookings,
              period,
              (booking) => booking.platformId === platform.id,
            ),
          0,
        ),
      }))
      .filter((item) => item.total > 0),
    categories: categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        total: sumExpenses(
          propertyExpenses,
          (expense) => expense.categoryId === category.id,
        ),
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total),
  };
}

export function getPropertiesMonthBreakdown(
  period: MonthPeriod,
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
) {
  return properties.map((property) => {
    const propertyBookings = bookings.filter(
      (booking) => booking.propertyId === property.id,
    );
    const propertyExpenses = expenses.filter(
      (expense) => expense.propertyId === property.id,
    );
    const monthExpenses = filterExpensesByPeriod(propertyExpenses, period);
    const income = sumBookingsInPeriod(propertyBookings, period);
    const expenseTotal = sumExpenses(monthExpenses);
    const profit = income - expenseTotal;

    return {
      id: property.id,
      name: property.name,
      income,
      expenses: expenseTotal,
      profit,
      margin: income > 0 ? profit / income : 0,
    };
  });
}

export function getPropertiesMonthlyMatrix(
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
) {
  return properties.map((property) => {
    const propertyBookings = bookings.filter(
      (booking) => booking.propertyId === property.id,
    );
    const propertyExpenses = expenses.filter(
      (expense) => expense.propertyId === property.id,
    );

    const months = getFiscalMonths().map((period) => {
      const monthExpenses = filterExpensesByPeriod(propertyExpenses, period);
      const income = sumBookingsInPeriod(propertyBookings, period);
      const expenseTotal = sumExpenses(monthExpenses);
      const profit = income - expenseTotal;

      return {
        period,
        label: getMonthLabel(period.month),
        income,
        expenses: expenseTotal,
        profit,
        margin: income > 0 ? profit / income : 0,
      };
    });

    const income = months.reduce((total, month) => total + month.income, 0);
    const expenseTotal = sumExpenses(propertyExpenses);
    const profit = income - expenseTotal;

    return {
      id: property.id,
      name: property.name,
      monthlyRent: property.monthlyRent,
      months,
      income,
      expenses: expenseTotal,
      profit,
      margin: income > 0 ? profit / income : 0,
    };
  });
}

export function getAggregatedPropertiesMonthlyMatrix(
  propertiesMatrix: ReturnType<typeof getPropertiesMonthlyMatrix>,
) {
  if (propertiesMatrix.length === 0) {
    return null;
  }

  const months = propertiesMatrix[0].months.map((month, monthIndex) => {
    const income = propertiesMatrix.reduce(
      (total, property) => total + property.months[monthIndex].income,
      0,
    );
    const expenses = propertiesMatrix.reduce(
      (total, property) => total + property.months[monthIndex].expenses,
      0,
    );
    const profit = income - expenses;

    return {
      period: month.period,
      label: month.label,
      income,
      expenses,
      profit,
      margin: income > 0 ? profit / income : 0,
    };
  });

  const income = months.reduce((total, month) => total + month.income, 0);
  const expenses = months.reduce((total, month) => total + month.expenses, 0);
  const profit = income - expenses;

  return {
    id: "all",
    name: "Tutti gli appartamenti",
    months,
    income,
    expenses,
    profit,
    margin: income > 0 ? profit / income : 0,
  };
}

export function getAllPropertiesMonthlyPlatformMatrix(
  bookings: Booking[],
  platforms: Platform[],
) {
  return {
    months: getFiscalMonths().map((period) => {
      const income = sumBookingsInPeriod(bookings, period);

      return {
        period,
        label: getMonthLabel(period.month),
        income,
        platforms: platforms.map((platform) => ({
          id: platform.id,
          name: platform.name,
          total: sumBookingsInPeriod(
            bookings,
            period,
            (booking) => booking.platformId === platform.id,
          ),
        })),
      };
    }),
    platforms: platforms.map((platform) => ({
      id: platform.id,
      name: platform.name,
      total: getFiscalMonths().reduce(
        (total, period) =>
          total +
          sumBookingsInPeriod(
            bookings,
            period,
            (booking) => booking.platformId === platform.id,
          ),
        0,
      ),
    })),
  };
}

export function getAllPropertiesMonthlyCategoryMatrix(
  expenses: Expense[],
  categories: ExpenseCategory[],
) {
  return {
    months: getFiscalMonths().map((period) => {
      const monthExpenses = filterExpensesByPeriod(expenses, period);
      const expenseTotal = sumExpenses(monthExpenses);

      return {
        period,
        label: getMonthLabel(period.month),
        expenses: expenseTotal,
        categories: categories.map((category) => ({
          id: category.id,
          name: category.name,
          total: sumExpenses(
            monthExpenses,
            (expense) => expense.categoryId === category.id,
          ),
        })),
      };
    }),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      total: sumExpenses(
        expenses,
        (expense) => expense.categoryId === category.id,
      ),
    })),
  };
}

export function getMonthlyDetail(
  period: MonthPeriod,
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  categories: ExpenseCategory[],
  platforms: Platform[],
  profitTargets: number[] = [],
) {
  const monthBookings = filterBookingsByPeriod(bookings, period);
  const monthExpenses = filterExpensesByPeriod(expenses, period);
  const income = sumBookingsInPeriod(bookings, period);
  const expenseTotal = sumExpenses(monthExpenses);
  const profit = income - expenseTotal;
  const target = getProfitTarget(profitTargets, period.month);

  return {
    period,
    label: getMonthLabel(period.month),
    income,
    expenses: expenseTotal,
    profit,
    margin: income > 0 ? profit / income : 0,
    target,
    targetGap: profit - target,
    targetMet: target > 0 ? profit >= target : null,
    platforms: groupBookingsByPlatform(bookings, platforms, period),
    properties: groupBookingsByProperty(bookings, properties, period),
    categories: groupExpensesByCategory(monthExpenses, categories),
  };
}

export function getScopedPlatformBreakdown(
  bookings: Booking[],
  platforms: Platform[],
  period?: MonthPeriod,
  propertyId?: string,
) {
  const filtered = propertyId
    ? bookings.filter((booking) => booking.propertyId === propertyId)
    : bookings;
  const total = period
    ? sumBookingsInPeriod(filtered, period)
    : sumBookings(filtered);

  return platforms.map((platform) => {
    const amount = period
      ? sumBookingsInPeriod(
          filtered,
          period,
          (booking) => booking.platformId === platform.id,
        )
      : sumBookings(
          filtered,
          (booking) => booking.platformId === platform.id,
        );

    return {
      id: platform.id,
      name: platform.name,
      total: amount,
      share: total > 0 ? amount / total : 0,
    };
  });
}

export function getScopedCategoryBreakdown(
  expenses: Expense[],
  categories: ExpenseCategory[],
  period?: MonthPeriod,
  propertyId?: string,
) {
  const scoped = period ? filterExpensesByPeriod(expenses, period) : expenses;
  const filtered = propertyId
    ? scoped.filter((expense) => expense.propertyId === propertyId)
    : scoped;
  const total = sumExpenses(filtered);

  return categories.map((category) => {
    const amount = sumExpenses(
      filtered,
      (expense) => expense.categoryId === category.id,
    );

    return {
      id: category.id,
      name: category.name,
      total: amount,
      share: total > 0 ? amount / total : 0,
    };
  });
}

export function getPropertiesMonthPlatformMatrix(
  period: MonthPeriod,
  bookings: Booking[],
  properties: Property[],
  platforms: Platform[],
) {
  return properties.map((property) => {
    const propertyBookings = bookings.filter(
      (booking) => booking.propertyId === property.id,
    );
    const income = sumBookingsInPeriod(propertyBookings, period);

    return {
      id: property.id,
      name: property.name,
      income,
      platforms: platforms.map((platform) => ({
        id: platform.id,
        name: platform.name,
        total: sumBookingsInPeriod(
          propertyBookings,
          period,
          (booking) => booking.platformId === platform.id,
        ),
      })),
    };
  });
}

export function getPropertiesMonthCategoryMatrix(
  period: MonthPeriod,
  expenses: Expense[],
  properties: Property[],
  categories: ExpenseCategory[],
) {
  return properties.map((property) => {
    const propertyExpenses = expenses.filter(
      (expense) => expense.propertyId === property.id,
    );
    const monthExpenses = filterExpensesByPeriod(propertyExpenses, period);
    const expenseTotal = sumExpenses(monthExpenses);

    return {
      id: property.id,
      name: property.name,
      expenses: expenseTotal,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        total: sumExpenses(
          monthExpenses,
          (expense) => expense.categoryId === category.id,
        ),
      })),
    };
  });
}

export function getPropertyMonthlyPlatformMatrix(
  propertyId: string,
  bookings: Booking[],
  platforms: Platform[],
) {
  const propertyBookings = bookings.filter(
    (booking) => booking.propertyId === propertyId,
  );

  return {
    months: getFiscalMonths().map((period) => {
      const income = sumBookingsInPeriod(propertyBookings, period);

      return {
        period,
        label: getMonthLabel(period.month),
        income,
        platforms: platforms.map((platform) => ({
          id: platform.id,
          name: platform.name,
          total: sumBookingsInPeriod(
            propertyBookings,
            period,
            (booking) => booking.platformId === platform.id,
          ),
        })),
      };
    }),
    platforms: platforms.map((platform) => ({
      id: platform.id,
      name: platform.name,
      total: getFiscalMonths().reduce(
        (total, period) =>
          total +
          sumBookingsInPeriod(
            propertyBookings,
            period,
            (booking) => booking.platformId === platform.id,
          ),
        0,
      ),
    })),
  };
}

export function getPropertyMonthlyCategoryMatrix(
  propertyId: string,
  expenses: Expense[],
  categories: ExpenseCategory[],
) {
  const propertyExpenses = expenses.filter(
    (expense) => expense.propertyId === propertyId,
  );

  return {
    months: getFiscalMonths().map((period) => {
      const monthExpenses = filterExpensesByPeriod(propertyExpenses, period);
      const expenseTotal = sumExpenses(monthExpenses);

      return {
        period,
        label: getMonthLabel(period.month),
        expenses: expenseTotal,
        categories: categories.map((category) => ({
          id: category.id,
          name: category.name,
          total: sumExpenses(
            monthExpenses,
            (expense) => expense.categoryId === category.id,
          ),
        })),
      };
    }),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      total: sumExpenses(
        propertyExpenses,
        (expense) => expense.categoryId === category.id,
      ),
    })),
  };
}

export function getPlatformMonthlyMatrix(
  bookings: Booking[],
  platforms: Platform[],
) {
  return platforms.map((platform) => ({
    id: platform.id,
    name: platform.name,
    months: getFiscalMonths().map((period) => ({
      period,
      total: sumBookingsInPeriod(
        bookings,
        period,
        (booking) => booking.platformId === platform.id,
      ),
    })),
    total: getFiscalMonths().reduce(
      (total, period) =>
        total +
        sumBookingsInPeriod(
          bookings,
          period,
          (booking) => booking.platformId === platform.id,
        ),
      0,
    ),
  }));
}

export function getCategoryMonthlyMatrix(
  expenses: Expense[],
  categories: ExpenseCategory[],
) {
  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      months: getFiscalMonths().map((period) => ({
        period,
        total: sumExpenses(
          expenses,
          (expense) =>
            expense.categoryId === category.id &&
            getPeriodFromDate(expense.date).year === period.year &&
            getPeriodFromDate(expense.date).month === period.month,
        ),
      })),
      total: sumExpenses(
        expenses,
        (expense) => expense.categoryId === category.id,
      ),
    }))
    .filter((row) => row.total > 0);
}
