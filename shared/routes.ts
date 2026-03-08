import { z } from 'zod';
import { 
  updateProfileSchema, 
  insertCourseSchema, 
  insertTutorCourseSchema,
  insertAvailabilitySchema,
  insertTutoringSessionSchema,
  updateSessionStatusSchema,
  scheduleSessionSchema,
  insertMessageSchema,
  insertReviewSchema,
  users, courses, tutorCourses, availabilities, tutoringSessions, messages, reviews
} from './schema';

export * from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  users: {
    me: {
      method: 'GET' as const,
      path: '/api/auth/user' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    updateProfile: {
      method: 'PATCH' as const,
      path: '/api/users/me' as const,
      input: updateProfileSchema,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    tutors: {
      method: 'GET' as const,
      path: '/api/users/tutors' as const,
      input: z.object({ courseId: z.string().optional(), university: z.string().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()), 
      }
    },
    getById: {
      method: 'GET' as const,
      path: '/api/users/:id' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    }
  },
  courses: {
    list: {
      method: 'GET' as const,
      path: '/api/courses' as const,
      input: z.object({ query: z.string().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof courses.$inferSelect>()),
      }
    }
  },
  tutorCourses: {
    list: {
      method: 'GET' as const,
      path: '/api/tutor-courses/:tutorId' as const,
      responses: {
        200: z.array(z.any()),
      }
    },
    add: {
      method: 'POST' as const,
      path: '/api/tutor-courses' as const,
      input: insertTutorCourseSchema,
      responses: {
        201: z.custom<typeof tutorCourses.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    },
    remove: {
      method: 'DELETE' as const,
      path: '/api/tutor-courses/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
      }
    }
  },
  availabilities: {
    list: {
      method: 'GET' as const,
      path: '/api/availabilities/:tutorId' as const,
      responses: {
        200: z.array(z.custom<typeof availabilities.$inferSelect>()),
      }
    },
    add: {
      method: 'POST' as const,
      path: '/api/availabilities' as const,
      input: insertAvailabilitySchema,
      responses: {
        201: z.custom<typeof availabilities.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    },
    remove: {
      method: 'DELETE' as const,
      path: '/api/availabilities/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
      }
    }
  },
  sessions: {
    list: {
      method: 'GET' as const,
      path: '/api/sessions' as const,
      responses: {
        200: z.array(z.custom<typeof tutoringSessions.$inferSelect>()),
        401: errorSchemas.unauthorized,
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/sessions/:id' as const,
      responses: {
        200: z.custom<typeof tutoringSessions.$inferSelect>(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/sessions' as const,
      input: insertTutoringSessionSchema,
      responses: {
        201: z.custom<typeof tutoringSessions.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/sessions/:id/status' as const,
      input: updateSessionStatusSchema,
      responses: {
        200: z.custom<typeof tutoringSessions.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    },
    schedule: {
      method: 'PATCH' as const,
      path: '/api/sessions/:id/schedule' as const,
      input: scheduleSessionSchema,
      responses: {
        200: z.custom<typeof tutoringSessions.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    }
  },
  messages: {
    list: {
      method: 'GET' as const,
      path: '/api/sessions/:sessionId/messages' as const,
      responses: {
        200: z.array(z.custom<typeof messages.$inferSelect>()),
        401: errorSchemas.unauthorized,
      }
    },
    send: {
      method: 'POST' as const,
      path: '/api/sessions/:sessionId/messages' as const,
      input: insertMessageSchema.omit({ sessionId: true }),
      responses: {
        201: z.custom<typeof messages.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    }
  },
  reviews: {
    create: {
      method: 'POST' as const,
      path: '/api/reviews' as const,
      input: insertReviewSchema,
      responses: {
        201: z.custom<typeof reviews.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    getByUser: {
      method: 'GET' as const,
      path: '/api/users/:userId/reviews' as const,
      responses: {
        200: z.array(z.custom<typeof reviews.$inferSelect>()),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
