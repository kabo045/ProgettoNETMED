--
-- PostgreSQL database dump
--

\restrict cJ6hKM7Wt0xjT4hsR0WJgUcdEVXBqzjplnk4R54t7da7325hcF07hPTLraHFXlg

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

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
-- Name: account_delete_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_delete_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(80) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.account_delete_tokens OWNER TO postgres;

--
-- Name: account_delete_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.account_delete_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.account_delete_tokens_id_seq OWNER TO postgres;

--
-- Name: account_delete_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.account_delete_tokens_id_seq OWNED BY public.account_delete_tokens.id;


--
-- Name: admin_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_audit (
    id integer NOT NULL,
    actor_id integer,
    action character varying(64) NOT NULL,
    target_type character varying(32),
    target_id integer,
    target_label character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_audit OWNER TO postgres;

--
-- Name: admin_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_audit_id_seq OWNER TO postgres;

--
-- Name: admin_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_audit_id_seq OWNED BY public.admin_audit.id;


--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_notifications (
    id integer NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    is_read boolean DEFAULT false NOT NULL,
    related_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_notifications OWNER TO postgres;

--
-- Name: admin_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_notifications_id_seq OWNER TO postgres;

--
-- Name: admin_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_notifications_id_seq OWNED BY public.admin_notifications.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: collection_videos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collection_videos (
    collection_id integer NOT NULL,
    video_id integer NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.collection_videos OWNER TO postgres;

--
-- Name: collections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collections (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(80) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.collections OWNER TO postgres;

--
-- Name: collections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.collections_id_seq OWNER TO postgres;

--
-- Name: collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.collections_id_seq OWNED BY public.collections.id;


--
-- Name: comment_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comment_reports (
    id integer NOT NULL,
    comment_id integer NOT NULL,
    reporter_user_id integer NOT NULL,
    reason character varying(40) DEFAULT 'altro'::character varying NOT NULL,
    note character varying(500),
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


ALTER TABLE public.comment_reports OWNER TO postgres;

--
-- Name: comment_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comment_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comment_reports_id_seq OWNER TO postgres;

--
-- Name: comment_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comment_reports_id_seq OWNED BY public.comment_reports.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    video_id integer NOT NULL,
    parent_id integer,
    content text NOT NULL,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: email_change_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_change_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    new_email character varying(120) NOT NULL,
    token character varying(80) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_change_tokens OWNER TO postgres;

--
-- Name: email_change_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_change_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_change_tokens_id_seq OWNER TO postgres;

--
-- Name: email_change_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.email_change_tokens_id_seq OWNED BY public.email_change_tokens.id;


--
-- Name: email_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(80) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_tokens OWNER TO postgres;

--
-- Name: email_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_tokens_id_seq OWNER TO postgres;

--
-- Name: email_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.email_tokens_id_seq OWNED BY public.email_tokens.id;


--
-- Name: likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.likes (
    user_id integer NOT NULL,
    video_id integer NOT NULL,
    vote smallint DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT likes_vote_check CHECK ((vote = ANY (ARRAY[1, '-1'::integer])))
);


ALTER TABLE public.likes OWNER TO postgres;

--
-- Name: nm_push_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nm_push_subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nm_push_subscriptions OWNER TO postgres;

--
-- Name: nm_push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nm_push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nm_push_subscriptions_id_seq OWNER TO postgres;

--
-- Name: nm_push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nm_push_subscriptions_id_seq OWNED BY public.nm_push_subscriptions.id;


--
-- Name: nm_user_follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nm_user_follows (
    follower_id integer NOT NULL,
    following_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nm_user_follows_check CHECK ((follower_id <> following_id))
);


ALTER TABLE public.nm_user_follows OWNER TO postgres;

--
-- Name: nm_watch_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nm_watch_progress (
    user_id integer NOT NULL,
    video_id integer NOT NULL,
    seconds integer DEFAULT 0 NOT NULL,
    duration integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nm_watch_progress OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(50) NOT NULL,
    payload jsonb,
    link text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(80) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    id integer NOT NULL,
    video_id integer NOT NULL,
    user_id integer NOT NULL,
    reason character varying(50) NOT NULL,
    comment text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp without time zone
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- Name: reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reports_id_seq OWNER TO postgres;

--
-- Name: reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reports_id_seq OWNED BY public.reports.id;


--
-- Name: tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tags (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tags OWNER TO postgres;

--
-- Name: tags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tags_id_seq OWNER TO postgres;

--
-- Name: tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tags_id_seq OWNED BY public.tags.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    password_hash text NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    avatar_url text,
    is_verified boolean DEFAULT false NOT NULL,
    verified_profile jsonb,
    verified_by integer,
    verified_at timestamp without time zone,
    verified_request boolean DEFAULT false NOT NULL,
    verified_request_at timestamp with time zone,
    email_confirmed boolean DEFAULT false NOT NULL,
    strike_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
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
-- Name: video_favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_favorites (
    user_id integer NOT NULL,
    video_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.video_favorites OWNER TO postgres;

--
-- Name: video_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_tags (
    video_id integer NOT NULL,
    tag_id integer NOT NULL
);


ALTER TABLE public.video_tags OWNER TO postgres;

--
-- Name: videos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.videos (
    id integer NOT NULL,
    youtube_id character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    thumbnail_url text,
    uploaded_by integer,
    category_id integer,
    is_private boolean DEFAULT false NOT NULL,
    is_flagged boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.videos OWNER TO postgres;

--
-- Name: videos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.videos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.videos_id_seq OWNER TO postgres;

--
-- Name: videos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.videos_id_seq OWNED BY public.videos.id;


--
-- Name: views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.views (
    id integer NOT NULL,
    user_id integer,
    video_id integer NOT NULL,
    viewed_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.views OWNER TO postgres;

--
-- Name: views_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.views_id_seq OWNER TO postgres;

--
-- Name: views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.views_id_seq OWNED BY public.views.id;


--
-- Name: account_delete_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_delete_tokens ALTER COLUMN id SET DEFAULT nextval('public.account_delete_tokens_id_seq'::regclass);


--
-- Name: admin_audit id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit ALTER COLUMN id SET DEFAULT nextval('public.admin_audit_id_seq'::regclass);


--
-- Name: admin_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications ALTER COLUMN id SET DEFAULT nextval('public.admin_notifications_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: collections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collections ALTER COLUMN id SET DEFAULT nextval('public.collections_id_seq'::regclass);


--
-- Name: comment_reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_reports ALTER COLUMN id SET DEFAULT nextval('public.comment_reports_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: email_change_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_change_tokens ALTER COLUMN id SET DEFAULT nextval('public.email_change_tokens_id_seq'::regclass);


--
-- Name: email_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_tokens ALTER COLUMN id SET DEFAULT nextval('public.email_tokens_id_seq'::regclass);


--
-- Name: nm_push_subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nm_push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.nm_push_subscriptions_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports ALTER COLUMN id SET DEFAULT nextval('public.reports_id_seq'::regclass);


--
-- Name: tags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags ALTER COLUMN id SET DEFAULT nextval('public.tags_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: videos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.videos ALTER COLUMN id SET DEFAULT nextval('public.videos_id_seq'::regclass);


--
-- Name: views id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.views ALTER COLUMN id SET DEFAULT nextval('public.views_id_seq'::regclass);


--
-- Data for Name: account_delete_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.account_delete_tokens (id, user_id, token, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: admin_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_audit (id, actor_id, action, target_type, target_id, target_label, created_at) FROM stdin;
\.


--
-- Data for Name: admin_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_notifications (id, type, title, message, is_read, related_id, created_at) FROM stdin;
1	info	Benvenuto su NETMED	Il pannello admin e' pronto	t	\N	2026-08-17 09:54:41.614413
2	new_video	Video da utente verificato	creatortest ha pubblicato "Video di test 1786961603537"	t	1	2026-08-17 10:13:23.549542
3	new_video	Video da utente verificato	creatortest ha pubblicato "Video di test 1786961788806"	t	2	2026-08-17 10:16:28.821516
4	new_video	Video da utente verificato	rahul2004 ha pubblicato "la Corea del Nord oltre la propaganda... 🇰🇵"	f	3	2026-08-17 10:52:04.051756
5	new_video	Video da utente verificato	rahul2004 ha pubblicato "Nozioni di base di merendina 2"	f	4	2026-08-17 10:52:26.57152
6	new_video	Video da utente verificato	rahul2004 ha pubblicato "Apparato cardiocircolatorio 01: Cuore - Configurazione esterna"	f	5	2026-08-29 09:23:12.102224
7	new_video	Video da utente verificato	rahul2004 ha pubblicato "Every Artery in the Human Body"	f	6	2026-08-29 09:29:17.466454
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, created_at) FROM stdin;
1	Fisioterapia	2026-08-17 09:54:41.627512
2	Neurologia	2026-08-17 09:54:41.627512
3	Ortopedia	2026-08-17 09:54:41.627512
4	Cardiologia	2026-08-17 09:54:41.627512
\.


--
-- Data for Name: collection_videos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.collection_videos (collection_id, video_id, added_at) FROM stdin;
\.


--
-- Data for Name: collections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.collections (id, user_id, name, created_at) FROM stdin;
\.


--
-- Data for Name: comment_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comment_reports (id, comment_id, reporter_user_id, reason, note, status, created_at, resolved_at) FROM stdin;
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comments (id, user_id, video_id, parent_id, content, deleted_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: email_change_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_change_tokens (id, user_id, new_email, token, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: email_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_tokens (id, user_id, token, expires_at, created_at) FROM stdin;
1	44	3631ce6ca314ae5073badf38fd78e38d1577e5cbd47525f9474c25b654b13792	2026-08-18 10:51:13.005+00	2026-08-17 10:51:13.006107+00
\.


--
-- Data for Name: likes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.likes (user_id, video_id, vote, created_at) FROM stdin;
\.


--
-- Data for Name: nm_push_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nm_push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) FROM stdin;
\.


--
-- Data for Name: nm_user_follows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nm_user_follows (follower_id, following_id, created_at) FROM stdin;
\.


--
-- Data for Name: nm_watch_progress; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nm_watch_progress (user_id, video_id, seconds, duration, updated_at) FROM stdin;
44	5	65	600	2026-08-29 09:24:48.370048
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, payload, link, read_at, created_at) FROM stdin;
3	44	welcome	{"title": "Benvenuto su NETMED!", "message": "Grazie per esserti iscritto. Esplora i video e iscriviti ai creator che ti interessano.", "username": "rahul2004"}	home.html	\N	2026-08-17 10:51:12.977265+00
4	1	creator_request	{"email": "rahulkabotra@gmail.com", "title": "Dr.", "qualifica": "Otorinolaringoiatra", "organization": "Centro di ricerca", "requested_user_id": 44, "requested_username": "rahul2004"}	admin_dashboard.html	\N	2026-08-17 10:51:13.002366+00
5	44	verified_granted	{"actor_id": 1, "actor_name": "admin"}	profilo.html	\N	2026-08-17 10:51:22.897275+00
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, user_id, token, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reports (id, video_id, user_id, reason, comment, status, created_at, reviewed_at) FROM stdin;
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tags (id, name, created_at) FROM stdin;
1	riabilitazione	2026-08-17 09:54:41.688105
2	ginocchio	2026-08-17 09:54:41.688105
3	spalla	2026-08-17 09:54:41.688105
4	fisioterapia	2026-08-17 09:54:41.688105
5	post-operatorio	2026-08-17 09:54:41.688105
8	cuore	2026-08-29 09:23:12.064867
9	arterie	2026-08-29 09:29:17.44924
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, username, password_hash, role, avatar_url, is_verified, verified_profile, verified_by, verified_at, verified_request, verified_request_at, email_confirmed, strike_count, created_at, updated_at) FROM stdin;
1	admin@netmed.com	admin	$2b$10$Jpqpm47V2hirE6MCZnkYBOrHF3gmTr7ufPLDyzbMCWc/pHR9MFnvu	admin	\N	f	\N	\N	\N	f	\N	t	0	2026-08-17 09:54:44.817835	2026-08-17 09:54:44.817835
44	rahulkabotra@gmail.com	rahul2004	$2b$10$anPW8QeppqlatBWw8BcxB.cP2HW6S/ZtdzgPahd.aor0.pLJRgXc2	user	\N	t	{"title": "Dr.", "qualifica": "Otorinolaringoiatra", "organization": "Centro di ricerca", "requested_at": "2026-08-17T10:51:12.984Z"}	1	2026-08-17 10:51:22.873046	f	2026-08-17 10:51:12.985686+00	f	0	2026-08-17 10:51:12.949092	2026-08-17 10:51:22.873046
\.


--
-- Data for Name: video_favorites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.video_favorites (user_id, video_id, created_at) FROM stdin;
\.


--
-- Data for Name: video_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.video_tags (video_id, tag_id) FROM stdin;
5	8
6	9
\.


--
-- Data for Name: videos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.videos (id, youtube_id, title, description, thumbnail_url, uploaded_by, category_id, is_private, is_flagged, created_at) FROM stdin;
5	7t66vXRXeQE	Apparato cardiocircolatorio 01: Cuore - Configurazione esterna	Scarica la mappa sulla configurazione esterna del cuore (a cura di Vincenzo Troiano): \nhttps://drive.google.com/open?id=1LVb...\nSEGUICI ANCHE SUL NUOVO CANALE INGLESE:    / @agoràbiomedicalsciences  \n\nDescrizione della configurazione esterna del cuore creata con Anatomylearning (http://anatomylearning.com/en/).\n\nCi trovi anche su Telegram: https://t.me/joinchat/AAAAAD7Spej_xVC...\nHow this was m	https://img.youtube.com/vi/7t66vXRXeQE/mqdefault.jpg	44	4	f	f	2026-08-29 09:23:12.087194
6	PH73pljqpGY	Every Artery in the Human Body	Learn the major arteries of the human body!\n\nIn this tutorial, Conor takes you through the major arteries of the thorax, abdomen, upper and lower limbs and the branches of the external carotid artery in less than 10 minutes.\n\nWatch our previous tutorial here:    • Anatomy of the Atlas and Axis	https://img.youtube.com/vi/PH73pljqpGY/mqdefault.jpg	44	4	f	f	2026-08-29 09:29:17.455589
\.


--
-- Data for Name: views; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.views (id, user_id, video_id, viewed_at) FROM stdin;
1	44	5	2026-08-29 09:23:18.366904
\.


--
-- Name: account_delete_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.account_delete_tokens_id_seq', 1, false);


--
-- Name: admin_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_audit_id_seq', 1, false);


--
-- Name: admin_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_notifications_id_seq', 7, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 6, true);


--
-- Name: collections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.collections_id_seq', 1, false);


--
-- Name: comment_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comment_reports_id_seq', 1, false);


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comments_id_seq', 2, true);


--
-- Name: email_change_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.email_change_tokens_id_seq', 1, false);


--
-- Name: email_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.email_tokens_id_seq', 1, true);


--
-- Name: nm_push_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nm_push_subscriptions_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 5, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, false);


--
-- Name: reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reports_id_seq', 1, false);


--
-- Name: tags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tags_id_seq', 9, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 44, true);


--
-- Name: videos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.videos_id_seq', 6, true);


--
-- Name: views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.views_id_seq', 1, true);


--
-- Name: account_delete_tokens account_delete_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_delete_tokens
    ADD CONSTRAINT account_delete_tokens_pkey PRIMARY KEY (id);


--
-- Name: account_delete_tokens account_delete_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_delete_tokens
    ADD CONSTRAINT account_delete_tokens_token_key UNIQUE (token);


--
-- Name: admin_audit admin_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit
    ADD CONSTRAINT admin_audit_pkey PRIMARY KEY (id);


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: collection_videos collection_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collection_videos
    ADD CONSTRAINT collection_videos_pkey PRIMARY KEY (collection_id, video_id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: collections collections_user_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_user_id_name_key UNIQUE (user_id, name);


--
-- Name: comment_reports comment_reports_comment_id_reporter_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_reports
    ADD CONSTRAINT comment_reports_comment_id_reporter_user_id_key UNIQUE (comment_id, reporter_user_id);


--
-- Name: comment_reports comment_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_reports
    ADD CONSTRAINT comment_reports_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: email_change_tokens email_change_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_change_tokens
    ADD CONSTRAINT email_change_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_change_tokens email_change_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_change_tokens
    ADD CONSTRAINT email_change_tokens_token_key UNIQUE (token);


--
-- Name: email_tokens email_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_tokens
    ADD CONSTRAINT email_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_tokens email_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_tokens
    ADD CONSTRAINT email_tokens_token_key UNIQUE (token);


--
-- Name: likes likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_pkey PRIMARY KEY (user_id, video_id);


--
-- Name: nm_push_subscriptions nm_push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nm_push_subscriptions
    ADD CONSTRAINT nm_push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: nm_push_subscriptions nm_push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nm_push_subscriptions
    ADD CONSTRAINT nm_push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: nm_user_follows nm_user_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nm_user_follows
    ADD CONSTRAINT nm_user_follows_pkey PRIMARY KEY (follower_id, following_id);


--
-- Name: nm_watch_progress nm_watch_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nm_watch_progress
    ADD CONSTRAINT nm_watch_progress_pkey PRIMARY KEY (user_id, video_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: reports reports_video_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_video_id_user_id_key UNIQUE (video_id, user_id);


--
-- Name: tags tags_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_name_key UNIQUE (name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


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
-- Name: video_favorites video_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_favorites
    ADD CONSTRAINT video_favorites_pkey PRIMARY KEY (user_id, video_id);


--
-- Name: video_tags video_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_tags
    ADD CONSTRAINT video_tags_pkey PRIMARY KEY (video_id, tag_id);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- Name: videos videos_youtube_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_youtube_id_key UNIQUE (youtube_id);


--
-- Name: views views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.views
    ADD CONSTRAINT views_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_notif_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_notif_date ON public.admin_notifications USING btree (created_at DESC);


--
-- Name: idx_admin_notif_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_notif_read ON public.admin_notifications USING btree (is_read);


--
-- Name: idx_adt_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_adt_token ON public.account_delete_tokens USING btree (token);


--
-- Name: idx_adt_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_adt_user_id ON public.account_delete_tokens USING btree (user_id);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_actor ON public.admin_audit USING btree (actor_id);


--
-- Name: idx_audit_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_date ON public.admin_audit USING btree (created_at DESC);


--
-- Name: idx_collections_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_collections_user ON public.collections USING btree (user_id);


--
-- Name: idx_comment_reports_comment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comment_reports_comment ON public.comment_reports USING btree (comment_id);


--
-- Name: idx_comment_reports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comment_reports_status ON public.comment_reports USING btree (status);


--
-- Name: idx_comments_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_parent ON public.comments USING btree (parent_id);


--
-- Name: idx_comments_video; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_video ON public.comments USING btree (video_id);


--
-- Name: idx_cv_video; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cv_video ON public.collection_videos USING btree (video_id);


--
-- Name: idx_ect_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ect_token ON public.email_change_tokens USING btree (token);


--
-- Name: idx_ect_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ect_user_id ON public.email_change_tokens USING btree (user_id);


--
-- Name: idx_et_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_et_token ON public.email_tokens USING btree (token);


--
-- Name: idx_et_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_et_user_id ON public.email_tokens USING btree (user_id);


--
-- Name: idx_favorites_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorites_user ON public.video_favorites USING btree (user_id);


--
-- Name: idx_favorites_video; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorites_video ON public.video_favorites USING btree (video_id);


--
-- Name: idx_fol_fol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fol_fol ON public.nm_user_follows USING btree (following_id);


--
-- Name: idx_likes_video; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_likes_video ON public.likes USING btree (video_id);


--
-- Name: idx_likes_vote; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_likes_vote ON public.likes USING btree (video_id, vote);


--
-- Name: idx_nm_user_follows_follower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nm_user_follows_follower ON public.nm_user_follows USING btree (follower_id);


--
-- Name: idx_nm_user_follows_following; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nm_user_follows_following ON public.nm_user_follows USING btree (following_id);


--
-- Name: idx_notif_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_user_date ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notif_user_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_user_unread ON public.notifications USING btree (user_id, read_at);


--
-- Name: idx_prt_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prt_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_prt_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prt_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_push_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_push_user ON public.nm_push_subscriptions USING btree (user_id);


--
-- Name: idx_reports_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_date ON public.reports USING btree (created_at DESC);


--
-- Name: idx_reports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_status ON public.reports USING btree (status);


--
-- Name: idx_reports_video; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reports_video ON public.reports USING btree (video_id);


--
-- Name: idx_tags_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tags_name ON public.tags USING btree (name);


--
-- Name: idx_users_strike_count; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_strike_count ON public.users USING btree (strike_count);


--
-- Name: idx_users_verified; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_verified ON public.users USING btree (id) WHERE (is_verified = true);


--
-- Name: idx_users_verified_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_verified_request ON public.users USING btree (verified_request_at) WHERE (verified_request = true);


--
-- Name: idx_video_tags_tag; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_video_tags_tag ON public.video_tags USING btree (tag_id);


--
-- Name: idx_videos_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_videos_category ON public.videos USING btree (category_id);


--
-- Name: idx_views_video; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_views_video ON public.views USING btree (video_id);


--
-- Name: idx_watch_progress_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_watch_progress_user ON public.nm_watch_progress USING btree (user_id, updated_at DESC);


--
-- Name: account_delete_tokens account_delete_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_delete_tokens
    ADD CONSTRAINT account_delete_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: admin_audit admin_audit_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit
    ADD CONSTRAINT admin_audit_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: collection_videos collection_videos_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collection_videos
    ADD CONSTRAINT collection_videos_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: collection_videos collection_videos_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collection_videos
    ADD CONSTRAINT collection_videos_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- Name: collections collections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comment_reports comment_reports_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_reports
    ADD CONSTRAINT comment_reports_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comment_reports comment_reports_reporter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_reports
    ADD CONSTRAINT comment_reports_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE SET NULL;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- Name: email_change_tokens email_change_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_change_tokens
    ADD CONSTRAINT email_change_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: email_tokens email_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_tokens
    ADD CONSTRAINT email_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: likes likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: likes likes_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- Name: nm_push_subscriptions nm_push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nm_push_subscriptions
    ADD CONSTRAINT nm_push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: nm_user_follows nm_user_follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nm_user_follows
    ADD CONSTRAINT nm_user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: nm_user_follows nm_user_follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nm_user_follows
    ADD CONSTRAINT nm_user_follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: nm_watch_progress nm_watch_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nm_watch_progress
    ADD CONSTRAINT nm_watch_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: nm_watch_progress nm_watch_progress_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nm_watch_progress
    ADD CONSTRAINT nm_watch_progress_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- Name: users users_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: video_favorites video_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_favorites
    ADD CONSTRAINT video_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: video_favorites video_favorites_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_favorites
    ADD CONSTRAINT video_favorites_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- Name: video_tags video_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_tags
    ADD CONSTRAINT video_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: video_tags video_tags_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_tags
    ADD CONSTRAINT video_tags_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- Name: videos videos_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: videos videos_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: views views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.views
    ADD CONSTRAINT views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: views views_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.views
    ADD CONSTRAINT views_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict cJ6hKM7Wt0xjT4hsR0WJgUcdEVXBqzjplnk4R54t7da7325hcF07hPTLraHFXlg

