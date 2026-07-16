--
-- PostgreSQL database dump
--

\restrict bwFZ7bbJgMC8sML9BFj5jEXcspOhrUig0PMOLQiK96XsobsX03QlulwrWAMhMXo

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alert_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alert_events (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    symbol character varying(32) NOT NULL,
    alert_type character varying(64) NOT NULL,
    severity character varying(16) DEFAULT 'info'::character varying NOT NULL,
    message text NOT NULL,
    related_signal_id integer,
    related_zone_id integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    acknowledged_at timestamp without time zone
);


ALTER TABLE public.alert_events OWNER TO postgres;

--
-- Name: alert_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alert_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alert_events_id_seq OWNER TO postgres;

--
-- Name: alert_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alert_events_id_seq OWNED BY public.alert_events.id;


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts (
    id integer NOT NULL,
    signal_id integer,
    alert_type character varying(50),
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.alerts OWNER TO postgres;

--
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alerts_id_seq OWNER TO postgres;

--
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assets (
    id integer NOT NULL,
    symbol character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.assets OWNER TO postgres;

--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assets_id_seq OWNER TO postgres;

--
-- Name: assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.assets_id_seq OWNED BY public.assets.id;


--
-- Name: backtest_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backtest_results (
    id bigint NOT NULL,
    backtest_run_id bigint NOT NULL,
    symbol character varying(32) NOT NULL,
    strategy_version_id bigint NOT NULL,
    setup_time timestamp without time zone NOT NULL,
    direction character varying(8) NOT NULL,
    setup_stage character varying(32) NOT NULL,
    quality_score numeric(5,2),
    entry numeric(24,10) NOT NULL,
    stop_loss numeric(24,10) NOT NULL,
    tp1 numeric(24,10),
    tp2 numeric(24,10),
    triggered_at timestamp without time zone,
    closed_at timestamp without time zone,
    outcome character varying(32) NOT NULL,
    final_r numeric(12,4),
    max_favourable_move numeric(24,10),
    max_adverse_move numeric(24,10),
    requires_review boolean DEFAULT false NOT NULL,
    review_reason text,
    details_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT backtest_results_direction_check CHECK (((direction)::text = ANY ((ARRAY['BUY'::character varying, 'SELL'::character varying])::text[])))
);


ALTER TABLE public.backtest_results OWNER TO postgres;

--
-- Name: backtest_results_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.backtest_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.backtest_results_id_seq OWNER TO postgres;

--
-- Name: backtest_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.backtest_results_id_seq OWNED BY public.backtest_results.id;


--
-- Name: backtest_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backtest_runs (
    id bigint NOT NULL,
    strategy_version_id bigint NOT NULL,
    symbol character varying(32) NOT NULL,
    timeframe character varying(16) NOT NULL,
    date_from timestamp without time zone NOT NULL,
    date_to timestamp without time zone NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    candles_evaluated integer DEFAULT 0 NOT NULL,
    setups_found integer DEFAULT 0 NOT NULL,
    completed_setups integer DEFAULT 0 NOT NULL,
    win_rate numeric(7,2),
    average_r numeric(12,4),
    total_r numeric(12,4),
    max_drawdown_r numeric(12,4),
    result_summary_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT backtest_runs_date_check CHECK ((date_to >= date_from)),
    CONSTRAINT backtest_runs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.backtest_runs OWNER TO postgres;

--
-- Name: backtest_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.backtest_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.backtest_runs_id_seq OWNER TO postgres;

--
-- Name: backtest_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.backtest_runs_id_seq OWNED BY public.backtest_runs.id;


--
-- Name: candles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candles (
    id bigint NOT NULL,
    asset_id integer,
    timeframe character varying(10) NOT NULL,
    open numeric(18,8) NOT NULL,
    high numeric(18,8) NOT NULL,
    low numeric(18,8) NOT NULL,
    close numeric(18,8) NOT NULL,
    volume numeric(18,2),
    candle_time timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    source character varying(32) DEFAULT 'twelve_direct'::character varying NOT NULL,
    broker_symbol character varying(64)
);


ALTER TABLE public.candles OWNER TO postgres;

--
-- Name: candles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.candles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.candles_id_seq OWNER TO postgres;

--
-- Name: candles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.candles_id_seq OWNED BY public.candles.id;


--
-- Name: market_scan_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.market_scan_runs (
    id integer NOT NULL,
    scan_type character varying(50) DEFAULT 'manual'::character varying,
    status character varying(50) NOT NULL,
    total_collections integer DEFAULT 0,
    successful_collections integer DEFAULT 0,
    failed_collections integer DEFAULT 0,
    signals_created integer DEFAULT 0,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


ALTER TABLE public.market_scan_runs OWNER TO postgres;

--
-- Name: market_scan_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.market_scan_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.market_scan_runs_id_seq OWNER TO postgres;

--
-- Name: market_scan_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.market_scan_runs_id_seq OWNED BY public.market_scan_runs.id;


--
-- Name: research_experiment_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.research_experiment_results (
    id bigint NOT NULL,
    experiment_id bigint NOT NULL,
    symbol character varying(32) NOT NULL,
    timeframe character varying(16) NOT NULL,
    date_from timestamp without time zone,
    date_to timestamp without time zone,
    metric_name character varying(120) NOT NULL,
    metric_value numeric(24,8),
    details_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.research_experiment_results OWNER TO postgres;

--
-- Name: research_experiment_results_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.research_experiment_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.research_experiment_results_id_seq OWNER TO postgres;

--
-- Name: research_experiment_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.research_experiment_results_id_seq OWNED BY public.research_experiment_results.id;


--
-- Name: research_experiments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.research_experiments (
    id bigint NOT NULL,
    experiment_key character varying(160) NOT NULL,
    experiment_name character varying(200) NOT NULL,
    description text,
    experiment_type character varying(64) NOT NULL,
    base_strategy_version_id bigint,
    parameters_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp without time zone,
    result_summary_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_message text,
    CONSTRAINT research_experiments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'insufficient_data'::character varying])::text[]))),
    CONSTRAINT research_experiments_type_check CHECK (((experiment_type)::text = ANY ((ARRAY['parameter_comparison'::character varying, 'strategy_comparison'::character varying, 'timeframe_comparison'::character varying, 'timeframe_readiness'::character varying, 'condition_analysis'::character varying, 'feature_analysis'::character varying])::text[])))
);


ALTER TABLE public.research_experiments OWNER TO postgres;

--
-- Name: research_experiments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.research_experiments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.research_experiments_id_seq OWNER TO postgres;

--
-- Name: research_experiments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.research_experiments_id_seq OWNED BY public.research_experiments.id;


--
-- Name: setup_journal; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.setup_journal (
    id bigint NOT NULL,
    signal_id integer,
    symbol character varying(32) NOT NULL,
    strategy_name character varying(100),
    strategy_version character varying(50),
    timeframe character varying(16),
    direction character varying(8),
    setup_stage character varying(32) DEFAULT 'READY'::character varying NOT NULL,
    quality_score numeric(5,2),
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    outcome character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    d1_bias character varying(32),
    h4_bias character varying(32),
    h1_trend character varying(32),
    ema_confirmation boolean,
    zone_type character varying(16),
    zone_timeframe character varying(16),
    zone_high numeric(24,10),
    zone_low numeric(24,10),
    zone_status character varying(32),
    distance_from_zone numeric(24,10),
    entry numeric(24,10),
    stop_loss numeric(24,10),
    tp1 numeric(24,10),
    tp2 numeric(24,10),
    risk_reward_tp1 numeric(10,4),
    risk_reward_tp2 numeric(10,4),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    triggered_at timestamp without time zone,
    closed_at timestamp without time zone,
    max_favourable_move numeric(24,10),
    max_adverse_move numeric(24,10),
    final_r_result numeric(12,4),
    review_status character varying(16) DEFAULT 'unreviewed'::character varying NOT NULL,
    reviewer_notes text,
    screenshot_url text,
    tags text[],
    data_source character varying(64) NOT NULL,
    provider_symbol character varying(64) NOT NULL,
    price_scale_mode character varying(32) NOT NULL,
    source_mode character varying(32) NOT NULL,
    entry_type character varying(32) DEFAULT 'setup'::character varying NOT NULL,
    notes text,
    dedupe_key text,
    broker_symbol character varying(64),
    broker_server character varying(128),
    account_currency character varying(16),
    execution_mode character varying(32) DEFAULT 'analysis_only'::character varying NOT NULL,
    broker_ticket character varying(128),
    actual_entry numeric(24,10),
    actual_stop_loss numeric(24,10),
    actual_take_profit numeric(24,10),
    actual_close_price numeric(24,10),
    actual_profit_loss numeric(24,10),
    actual_profit_loss_currency character varying(16),
    lifecycle_status character varying(32) DEFAULT 'ready'::character varying,
    lifecycle_last_checked_at timestamp without time zone,
    lifecycle_last_price numeric(24,10),
    lifecycle_last_candle_time timestamp without time zone,
    lifecycle_reason text,
    lifecycle_update_count integer DEFAULT 0 NOT NULL,
    requires_review boolean DEFAULT false NOT NULL,
    review_reason text,
    CONSTRAINT setup_journal_direction_check CHECK (((direction)::text = ANY ((ARRAY['BUY'::character varying, 'SELL'::character varying])::text[]))),
    CONSTRAINT setup_journal_entry_type_check CHECK (((entry_type)::text = ANY ((ARRAY['setup'::character varying, 'watch'::character varying, 'observation'::character varying, 'provider_limited'::character varying])::text[]))),
    CONSTRAINT setup_journal_execution_mode_check CHECK (((execution_mode)::text = ANY ((ARRAY['analysis_only'::character varying, 'manual_reconciliation'::character varying])::text[]))),
    CONSTRAINT setup_journal_lifecycle_status_check CHECK (((lifecycle_status IS NULL) OR ((lifecycle_status)::text = ANY ((ARRAY['watching'::character varying, 'ready'::character varying, 'triggered'::character varying, 'active'::character varying, 'completed'::character varying, 'invalidated'::character varying, 'expired'::character varying, 'manually_closed'::character varying, 'requires_review'::character varying])::text[])))),
    CONSTRAINT setup_journal_outcome_check CHECK (((outcome)::text = ANY ((ARRAY['pending'::character varying, 'watching'::character varying, 'triggered'::character varying, 'tp1_hit'::character varying, 'tp2_hit'::character varying, 'stopped_out'::character varying, 'invalidated'::character varying, 'expired'::character varying, 'manually_closed'::character varying, 'requires_review'::character varying, 'ambiguous'::character varying, 'converted_to_setup'::character varying, 'reviewed'::character varying, 'ignored'::character varying])::text[]))),
    CONSTRAINT setup_journal_review_status_check CHECK (((review_status)::text = ANY ((ARRAY['unreviewed'::character varying, 'reviewed'::character varying, 'ignored'::character varying])::text[]))),
    CONSTRAINT setup_journal_shape_check CHECK (((((entry_type)::text = 'setup'::text) AND ((direction)::text = ANY ((ARRAY['BUY'::character varying, 'SELL'::character varying])::text[])) AND (entry IS NOT NULL) AND (stop_loss IS NOT NULL) AND ((tp1 IS NOT NULL) OR (tp2 IS NOT NULL)) AND (strategy_name IS NOT NULL)) OR ((entry_type)::text <> 'setup'::text))),
    CONSTRAINT setup_journal_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'watching'::character varying, 'triggered'::character varying, 'tp1_hit'::character varying, 'tp2_hit'::character varying, 'stopped_out'::character varying, 'invalidated'::character varying, 'expired'::character varying, 'manually_closed'::character varying, 'converted_to_setup'::character varying, 'reviewed'::character varying, 'ignored'::character varying])::text[])))
);


ALTER TABLE public.setup_journal OWNER TO postgres;

--
-- Name: setup_journal_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.setup_journal_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.setup_journal_id_seq OWNER TO postgres;

--
-- Name: setup_journal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.setup_journal_id_seq OWNED BY public.setup_journal.id;


--
-- Name: signals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.signals (
    id integer NOT NULL,
    asset_id integer,
    signal_type character varying(10) NOT NULL,
    entry_price numeric(18,8) NOT NULL,
    stop_loss numeric(18,8) NOT NULL,
    take_profit_1 numeric(18,8),
    take_profit_2 numeric(18,8),
    risk_reward numeric(10,2),
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    risk_amount numeric(18,8),
    account_risk_amount numeric(18,8),
    position_size_units numeric(18,8),
    position_size_note text,
    closed_at timestamp without time zone,
    exit_price numeric(18,8),
    outcome_reason text,
    zone_id integer
);


ALTER TABLE public.signals OWNER TO postgres;

--
-- Name: signals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.signals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.signals_id_seq OWNER TO postgres;

--
-- Name: signals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.signals_id_seq OWNED BY public.signals.id;


--
-- Name: strategy_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.strategy_versions (
    id bigint NOT NULL,
    strategy_key character varying(100) NOT NULL,
    strategy_name character varying(160) NOT NULL,
    version character varying(50) NOT NULL,
    description text,
    rules_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    timeframe_primary character varying(16) NOT NULL,
    timeframe_confirmation character varying(16),
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.strategy_versions OWNER TO postgres;

--
-- Name: strategy_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.strategy_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.strategy_versions_id_seq OWNER TO postgres;

--
-- Name: strategy_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.strategy_versions_id_seq OWNED BY public.strategy_versions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255),
    password_hash text NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: zones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zones (
    id integer NOT NULL,
    asset_id integer,
    zone_type character varying(20) NOT NULL,
    zone_high numeric(18,8) NOT NULL,
    zone_low numeric(18,8) NOT NULL,
    timeframe character varying(10) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    strength integer DEFAULT 1,
    source_time timestamp without time zone,
    touched_at timestamp without time zone,
    mitigated_at timestamp without time zone,
    broken_at timestamp without time zone
);


ALTER TABLE public.zones OWNER TO postgres;

--
-- Name: zones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zones_id_seq OWNER TO postgres;

--
-- Name: zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zones_id_seq OWNED BY public.zones.id;


--
-- Name: alert_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_events ALTER COLUMN id SET DEFAULT nextval('public.alert_events_id_seq'::regclass);


--
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- Name: assets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets ALTER COLUMN id SET DEFAULT nextval('public.assets_id_seq'::regclass);


--
-- Name: backtest_results id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backtest_results ALTER COLUMN id SET DEFAULT nextval('public.backtest_results_id_seq'::regclass);


--
-- Name: backtest_runs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backtest_runs ALTER COLUMN id SET DEFAULT nextval('public.backtest_runs_id_seq'::regclass);


--
-- Name: candles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candles ALTER COLUMN id SET DEFAULT nextval('public.candles_id_seq'::regclass);


--
-- Name: market_scan_runs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_scan_runs ALTER COLUMN id SET DEFAULT nextval('public.market_scan_runs_id_seq'::regclass);


--
-- Name: research_experiment_results id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_experiment_results ALTER COLUMN id SET DEFAULT nextval('public.research_experiment_results_id_seq'::regclass);


--
-- Name: research_experiments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_experiments ALTER COLUMN id SET DEFAULT nextval('public.research_experiments_id_seq'::regclass);


--
-- Name: setup_journal id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setup_journal ALTER COLUMN id SET DEFAULT nextval('public.setup_journal_id_seq'::regclass);


--
-- Name: signals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signals ALTER COLUMN id SET DEFAULT nextval('public.signals_id_seq'::regclass);


--
-- Name: strategy_versions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.strategy_versions ALTER COLUMN id SET DEFAULT nextval('public.strategy_versions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: zones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones ALTER COLUMN id SET DEFAULT nextval('public.zones_id_seq'::regclass);


--
-- Name: alert_events alert_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: assets assets_symbol_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_symbol_key UNIQUE (symbol);


--
-- Name: backtest_results backtest_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backtest_results
    ADD CONSTRAINT backtest_results_pkey PRIMARY KEY (id);


--
-- Name: backtest_runs backtest_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backtest_runs
    ADD CONSTRAINT backtest_runs_pkey PRIMARY KEY (id);


--
-- Name: candles candles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candles
    ADD CONSTRAINT candles_pkey PRIMARY KEY (id);


--
-- Name: market_scan_runs market_scan_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_scan_runs
    ADD CONSTRAINT market_scan_runs_pkey PRIMARY KEY (id);


--
-- Name: research_experiment_results research_experiment_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_experiment_results
    ADD CONSTRAINT research_experiment_results_pkey PRIMARY KEY (id);


--
-- Name: research_experiments research_experiments_experiment_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_experiments
    ADD CONSTRAINT research_experiments_experiment_key_key UNIQUE (experiment_key);


--
-- Name: research_experiments research_experiments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_experiments
    ADD CONSTRAINT research_experiments_pkey PRIMARY KEY (id);


--
-- Name: setup_journal setup_journal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setup_journal
    ADD CONSTRAINT setup_journal_pkey PRIMARY KEY (id);


--
-- Name: setup_journal setup_journal_signal_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setup_journal
    ADD CONSTRAINT setup_journal_signal_id_key UNIQUE (signal_id);


--
-- Name: signals signals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signals
    ADD CONSTRAINT signals_pkey PRIMARY KEY (id);


--
-- Name: strategy_versions strategy_versions_key_version_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.strategy_versions
    ADD CONSTRAINT strategy_versions_key_version_unique UNIQUE (strategy_key, version);


--
-- Name: strategy_versions strategy_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.strategy_versions
    ADD CONSTRAINT strategy_versions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: idx_alert_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_events_created_at ON public.alert_events USING btree (created_at DESC);


--
-- Name: idx_alert_events_symbol_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_events_symbol_created_at ON public.alert_events USING btree (symbol, created_at DESC);


--
-- Name: idx_backtest_results_outcome; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_backtest_results_outcome ON public.backtest_results USING btree (outcome);


--
-- Name: idx_backtest_results_run_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_backtest_results_run_id ON public.backtest_results USING btree (backtest_run_id);


--
-- Name: idx_backtest_results_setup_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_backtest_results_setup_time ON public.backtest_results USING btree (setup_time);


--
-- Name: idx_backtest_results_strategy_version_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_backtest_results_strategy_version_id ON public.backtest_results USING btree (strategy_version_id);


--
-- Name: idx_backtest_results_symbol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_backtest_results_symbol ON public.backtest_results USING btree (symbol);


--
-- Name: idx_backtest_runs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_backtest_runs_created_at ON public.backtest_runs USING btree (created_at DESC);


--
-- Name: idx_backtest_runs_strategy_version_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_backtest_runs_strategy_version_id ON public.backtest_runs USING btree (strategy_version_id);


--
-- Name: idx_backtest_runs_symbol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_backtest_runs_symbol ON public.backtest_runs USING btree (symbol);


--
-- Name: idx_candles_broker_symbol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candles_broker_symbol ON public.candles USING btree (broker_symbol) WHERE (broker_symbol IS NOT NULL);


--
-- Name: idx_candles_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candles_source ON public.candles USING btree (source);


--
-- Name: idx_research_experiments_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_research_experiments_key ON public.research_experiments USING btree (experiment_key);


--
-- Name: idx_research_experiments_strategy; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_research_experiments_strategy ON public.research_experiments USING btree (base_strategy_version_id);


--
-- Name: idx_research_experiments_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_research_experiments_type ON public.research_experiments USING btree (experiment_type);


--
-- Name: idx_research_results_metric; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_research_results_metric ON public.research_experiment_results USING btree (metric_name);


--
-- Name: idx_research_results_symbol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_research_results_symbol ON public.research_experiment_results USING btree (symbol);


--
-- Name: idx_research_results_timeframe; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_research_results_timeframe ON public.research_experiment_results USING btree (timeframe);


--
-- Name: idx_setup_journal_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_setup_journal_created_at ON public.setup_journal USING btree (created_at DESC);


--
-- Name: idx_setup_journal_entry_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_setup_journal_entry_type ON public.setup_journal USING btree (entry_type);


--
-- Name: idx_setup_journal_lifecycle_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_setup_journal_lifecycle_open ON public.setup_journal USING btree (entry_type, lifecycle_status, created_at DESC) WHERE ((lifecycle_status)::text = ANY ((ARRAY['watching'::character varying, 'ready'::character varying, 'triggered'::character varying, 'active'::character varying, 'requires_review'::character varying])::text[]));


--
-- Name: idx_setup_journal_lifecycle_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_setup_journal_lifecycle_status ON public.setup_journal USING btree (lifecycle_status);


--
-- Name: idx_setup_journal_outcome; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_setup_journal_outcome ON public.setup_journal USING btree (outcome);


--
-- Name: idx_setup_journal_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_setup_journal_status ON public.setup_journal USING btree (status);


--
-- Name: idx_setup_journal_strategy_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_setup_journal_strategy_name ON public.setup_journal USING btree (strategy_name);


--
-- Name: idx_setup_journal_symbol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_setup_journal_symbol ON public.setup_journal USING btree (symbol);


--
-- Name: idx_strategy_versions_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_strategy_versions_is_active ON public.strategy_versions USING btree (is_active);


--
-- Name: idx_strategy_versions_strategy_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_strategy_versions_strategy_key ON public.strategy_versions USING btree (strategy_key);


--
-- Name: idx_strategy_versions_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_strategy_versions_version ON public.strategy_versions USING btree (version);


--
-- Name: unique_candles_asset_timeframe_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_candles_asset_timeframe_time ON public.candles USING btree (asset_id, timeframe, candle_time);


--
-- Name: unique_setup_journal_dedupe_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_setup_journal_dedupe_key ON public.setup_journal USING btree (dedupe_key) WHERE (dedupe_key IS NOT NULL);


--
-- Name: unique_zones_asset_timeframe_type_levels_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_zones_asset_timeframe_type_levels_status ON public.zones USING btree (asset_id, timeframe, zone_type, zone_high, zone_low, status);


--
-- Name: alert_events alert_events_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: alert_events alert_events_related_signal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_related_signal_id_fkey FOREIGN KEY (related_signal_id) REFERENCES public.signals(id);


--
-- Name: alert_events alert_events_related_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_related_zone_id_fkey FOREIGN KEY (related_zone_id) REFERENCES public.zones(id);


--
-- Name: alerts alerts_signal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_signal_id_fkey FOREIGN KEY (signal_id) REFERENCES public.signals(id) ON DELETE CASCADE;


--
-- Name: backtest_results backtest_results_backtest_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backtest_results
    ADD CONSTRAINT backtest_results_backtest_run_id_fkey FOREIGN KEY (backtest_run_id) REFERENCES public.backtest_runs(id) ON DELETE CASCADE;


--
-- Name: backtest_results backtest_results_strategy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backtest_results
    ADD CONSTRAINT backtest_results_strategy_version_id_fkey FOREIGN KEY (strategy_version_id) REFERENCES public.strategy_versions(id) ON DELETE RESTRICT;


--
-- Name: backtest_runs backtest_runs_strategy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backtest_runs
    ADD CONSTRAINT backtest_runs_strategy_version_id_fkey FOREIGN KEY (strategy_version_id) REFERENCES public.strategy_versions(id) ON DELETE RESTRICT;


--
-- Name: candles candles_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candles
    ADD CONSTRAINT candles_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: research_experiment_results research_experiment_results_experiment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_experiment_results
    ADD CONSTRAINT research_experiment_results_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES public.research_experiments(id) ON DELETE CASCADE;


--
-- Name: research_experiments research_experiments_base_strategy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_experiments
    ADD CONSTRAINT research_experiments_base_strategy_version_id_fkey FOREIGN KEY (base_strategy_version_id) REFERENCES public.strategy_versions(id) ON DELETE SET NULL;


--
-- Name: setup_journal setup_journal_signal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setup_journal
    ADD CONSTRAINT setup_journal_signal_id_fkey FOREIGN KEY (signal_id) REFERENCES public.signals(id) ON DELETE SET NULL;


--
-- Name: signals signals_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signals
    ADD CONSTRAINT signals_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: signals signals_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signals
    ADD CONSTRAINT signals_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- Name: zones zones_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

--
-- V5 final core operational state additions from migration 015
--

CREATE TABLE IF NOT EXISTS public.live_ticks (
    id integer NOT NULL,
    platform_symbol character varying(20) NOT NULL,
    broker_symbol character varying(64) NOT NULL,
    bid numeric(24,10),
    ask numeric(24,10),
    last numeric(24,10),
    display_price numeric(24,10) NOT NULL,
    spread numeric(24,10),
    tick_time timestamp with time zone NOT NULL,
    received_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    utc_storage_valid boolean DEFAULT false NOT NULL,
    freshness character varying(32) DEFAULT 'live'::character varying NOT NULL,
    status character varying(32) DEFAULT 'live'::character varying NOT NULL,
    source character varying(32) DEFAULT 'mt5_broker'::character varying NOT NULL,
    raw_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT live_ticks_positive_display_price CHECK ((display_price > (0)::numeric)),
    CONSTRAINT live_ticks_source_check CHECK (((source)::text = 'mt5_broker'::text))
);

CREATE SEQUENCE IF NOT EXISTS public.live_ticks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.live_ticks_id_seq OWNED BY public.live_ticks.id;
ALTER TABLE ONLY public.live_ticks ALTER COLUMN id SET DEFAULT nextval('public.live_ticks_id_seq'::regclass);
ALTER TABLE ONLY public.live_ticks ADD CONSTRAINT live_ticks_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS idx_live_ticks_symbol_received ON public.live_ticks USING btree (platform_symbol, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_ticks_symbol_tick_time ON public.live_ticks USING btree (platform_symbol, tick_time DESC);
CREATE INDEX IF NOT EXISTS idx_live_ticks_valid_symbol_received ON public.live_ticks USING btree (platform_symbol, received_at DESC) WHERE ((utc_storage_valid = true) AND ((source)::text = 'mt5_broker'::text));

CREATE TABLE IF NOT EXISTS public.core_ema_states (
    id integer NOT NULL,
    platform_symbol character varying(20) NOT NULL,
    broker_symbol character varying(64) NOT NULL,
    timeframe character varying(10) NOT NULL,
    latest_closed_price numeric(24,10),
    ema_200 numeric(24,10),
    price_above_ema boolean,
    price_below_ema boolean,
    distance_from_ema numeric(24,10),
    trend_state character varying(32) NOT NULL,
    calculated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    candle_time timestamp without time zone,
    source character varying(32) DEFAULT 'mt5_broker'::character varying NOT NULL,
    CONSTRAINT core_ema_states_source_check CHECK (((source)::text = 'mt5_broker'::text))
);

CREATE SEQUENCE IF NOT EXISTS public.core_ema_states_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.core_ema_states_id_seq OWNED BY public.core_ema_states.id;
ALTER TABLE ONLY public.core_ema_states ALTER COLUMN id SET DEFAULT nextval('public.core_ema_states_id_seq'::regclass);
ALTER TABLE ONLY public.core_ema_states ADD CONSTRAINT core_ema_states_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.core_ema_states ADD CONSTRAINT core_ema_states_platform_symbol_timeframe_key UNIQUE (platform_symbol, timeframe);

ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS broker_symbol character varying(64),
  ADD COLUMN IF NOT EXISTS origin_time timestamp without time zone,
  ADD COLUMN IF NOT EXISTS origin_candle_index integer,
  ADD COLUMN IF NOT EXISTS base_start_time timestamp without time zone,
  ADD COLUMN IF NOT EXISTS base_end_time timestamp without time zone,
  ADD COLUMN IF NOT EXISTS departure_strength numeric(12,4),
  ADD COLUMN IF NOT EXISTS quality_score numeric(12,4),
  ADD COLUMN IF NOT EXISTS test_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS distance_from_live_price numeric(24,10),
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  ADD COLUMN IF NOT EXISTS invalidated_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS invalidation_reason text,
  ADD COLUMN IF NOT EXISTS source character varying(32) DEFAULT 'mt5_broker'::character varying NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zones_core_active ON public.zones USING btree (asset_id, timeframe, status, updated_at DESC);

ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS proximal_price numeric(24,10),
  ADD COLUMN IF NOT EXISTS distal_price numeric(24,10);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zones_h4_origin_mt5_unique
  ON public.zones USING btree (asset_id, timeframe, zone_type, origin_time, source)
  WHERE ((origin_time IS NOT NULL) AND ((source)::text = 'mt5_broker'::text));

ALTER TABLE public.alert_events
  ADD COLUMN IF NOT EXISTS dedupe_key character varying(255),
  ADD COLUMN IF NOT EXISTS resolved_at timestamp without time zone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_events_dedupe_open ON public.alert_events USING btree (dedupe_key) WHERE ((dedupe_key IS NOT NULL) AND (resolved_at IS NULL));


--
-- PostgreSQL database dump complete
--

\unrestrict bwFZ7bbJgMC8sML9BFj5jEXcspOhrUig0PMOLQiK96XsobsX03QlulwrWAMhMXo
