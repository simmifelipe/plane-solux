/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TCalendarLayouts } from "@plane/types";
import { EStartOfTheWeek } from "@plane/types";

export const MONTHS_LIST: {
  [monthNumber: number]: {
    shortTitle: string;
    title: string;
    i18n_short_title: string;
    i18n_title: string;
  };
} = {
  1: {
    shortTitle: "Jan",
    title: "January",
    i18n_short_title: "ui.month_january_short",
    i18n_title: "ui.month_january",
  },
  2: {
    shortTitle: "Feb",
    title: "February",
    i18n_short_title: "ui.month_february_short",
    i18n_title: "ui.month_february",
  },
  3: {
    shortTitle: "Mar",
    title: "March",
    i18n_short_title: "ui.month_march_short",
    i18n_title: "ui.month_march",
  },
  4: {
    shortTitle: "Apr",
    title: "April",
    i18n_short_title: "ui.month_april_short",
    i18n_title: "ui.month_april",
  },
  5: {
    shortTitle: "May",
    title: "May",
    i18n_short_title: "ui.month_may_short",
    i18n_title: "ui.month_may",
  },
  6: {
    shortTitle: "Jun",
    title: "June",
    i18n_short_title: "ui.month_june_short",
    i18n_title: "ui.month_june",
  },
  7: {
    shortTitle: "Jul",
    title: "July",
    i18n_short_title: "ui.month_july_short",
    i18n_title: "ui.month_july",
  },
  8: {
    shortTitle: "Aug",
    title: "August",
    i18n_short_title: "ui.month_august_short",
    i18n_title: "ui.month_august",
  },
  9: {
    shortTitle: "Sep",
    title: "September",
    i18n_short_title: "ui.month_september_short",
    i18n_title: "ui.month_september",
  },
  10: {
    shortTitle: "Oct",
    title: "October",
    i18n_short_title: "ui.month_october_short",
    i18n_title: "ui.month_october",
  },
  11: {
    shortTitle: "Nov",
    title: "November",
    i18n_short_title: "ui.month_november_short",
    i18n_title: "ui.month_november",
  },
  12: {
    shortTitle: "Dec",
    title: "December",
    i18n_short_title: "ui.month_december_short",
    i18n_title: "ui.month_december",
  },
};

export const DAYS_LIST: {
  [dayIndex: number]: {
    shortTitle: string;
    title: string;
    i18n_short_title: string;
    i18n_title: string;
    value: EStartOfTheWeek;
  };
} = {
  1: {
    shortTitle: "Sun",
    title: "Sunday",
    i18n_short_title: "ui.day_sunday_short",
    i18n_title: "ui.day_sunday",
    value: EStartOfTheWeek.SUNDAY,
  },
  2: {
    shortTitle: "Mon",
    title: "Monday",
    i18n_short_title: "ui.day_monday_short",
    i18n_title: "ui.day_monday",
    value: EStartOfTheWeek.MONDAY,
  },
  3: {
    shortTitle: "Tue",
    title: "Tuesday",
    i18n_short_title: "ui.day_tuesday_short",
    i18n_title: "ui.day_tuesday",
    value: EStartOfTheWeek.TUESDAY,
  },
  4: {
    shortTitle: "Wed",
    title: "Wednesday",
    i18n_short_title: "ui.day_wednesday_short",
    i18n_title: "ui.day_wednesday",
    value: EStartOfTheWeek.WEDNESDAY,
  },
  5: {
    shortTitle: "Thu",
    title: "Thursday",
    i18n_short_title: "ui.day_thursday_short",
    i18n_title: "ui.day_thursday",
    value: EStartOfTheWeek.THURSDAY,
  },
  6: {
    shortTitle: "Fri",
    title: "Friday",
    i18n_short_title: "ui.day_friday_short",
    i18n_title: "ui.day_friday",
    value: EStartOfTheWeek.FRIDAY,
  },
  7: {
    shortTitle: "Sat",
    title: "Saturday",
    i18n_short_title: "ui.day_saturday_short",
    i18n_title: "ui.day_saturday",
    value: EStartOfTheWeek.SATURDAY,
  },
};

export const CALENDAR_LAYOUTS: {
  [layout in TCalendarLayouts]: {
    key: TCalendarLayouts;
    title: string;
    i18n_title: string;
  };
} = {
  month: {
    key: "month",
    title: "Month layout",
    i18n_title: "ui.month_layout",
  },
  week: {
    key: "week",
    title: "Week layout",
    i18n_title: "ui.week_layout",
  },
};
