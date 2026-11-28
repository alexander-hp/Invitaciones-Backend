const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      index: true,
      trim: true,
      maxlength: 64
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      maxlength: 80
    },
    distinctId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      maxlength: 80
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    userRole: {
      type: String,
      default: 'guest',
      index: true,
      maxlength: 32
    },
    route: {
      type: String,
      default: '/',
      index: true,
      maxlength: 140
    },
    rawPath: {
      type: String,
      default: '/',
      maxlength: 180
    },
    routeLabel: {
      type: String,
      default: 'Pantalla',
      maxlength: 120
    },
    moduleGroup: {
      type: String,
      default: 'Gestión Evento',
      maxlength: 60
    },
    sectionTab: {
      type: String,
      default: '',
      maxlength: 80
    },
    pageSection: {
      type: String,
      default: '',
      maxlength: 120
    },
    deviceType: {
      type: String,
      default: 'Web Desktop',
      index: true,
      maxlength: 32
    },
    browser: {
      type: String,
      default: 'Web',
      maxlength: 40
    },
    os: {
      type: String,
      default: '',
      maxlength: 40
    },
    viewport: {
      type: String,
      default: '',
      maxlength: 24
    },
    dwellSeconds: {
      type: Number,
      default: null
    },
    maxScrollPct: {
      type: Number,
      default: null
    },
    routeLoadMs: {
      type: Number,
      default: null
    },
    exitReason: {
      type: String,
      default: '',
      maxlength: 32
    },
    targetLabel: {
      type: String,
      default: '',
      maxlength: 120
    },
    selector: {
      type: String,
      default: '',
      maxlength: 120
    },
    featureKey: {
      type: String,
      default: '',
      maxlength: 64
    },
    featureCategory: {
      type: String,
      default: '',
      maxlength: 64
    },
    formName: {
      type: String,
      default: '',
      maxlength: 100
    },
    fieldsTouched: {
      type: Number,
      default: null
    },
    endpoint: {
      type: String,
      default: '',
      maxlength: 140
    },
    httpMethod: {
      type: String,
      default: '',
      maxlength: 12
    },
    statusCode: {
      type: Number,
      default: null
    },
    durationMs: {
      type: Number,
      default: null
    },
    errorMessage: {
      type: String,
      default: '',
      maxlength: 260
    },
    stackTop: {
      type: String,
      default: '',
      maxlength: 220
    },
    lastBreadcrumb: {
      type: String,
      default: '',
      maxlength: 180
    },
    isDiagnostic: {
      type: Boolean,
      default: false
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }
    }
  },
  {
    versionKey: false
  }
);

analyticsEventSchema.index({ occurredAt: -1, event: 1 });
analyticsEventSchema.index({ route: 1, occurredAt: -1 });
analyticsEventSchema.index({ distinctId: 1, occurredAt: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
