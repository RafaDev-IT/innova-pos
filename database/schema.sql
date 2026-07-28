-- =============================================================================
-- Innova POS — Esquema de base de datos (PostgreSQL 16)
-- =============================================================================
--
-- Este archivo es una alternativa a las migraciones para quien prefiera crear
-- el esquema de un solo paso. Se generó con pg_dump a partir de la base
-- resultante de aplicar las migraciones, por lo que ambos caminos producen
-- exactamente la misma estructura.
--
-- Uso:
--   createdb innova_pos
--   psql -d innova_pos -f database/schema.sql
--
-- La vía recomendada sigue siendo `npm run db:setup` desde backend/, que
-- además carga el catálogo de ejemplo.
--
-- Tablas:
--   products     catálogo, con borrado lógico (deleted_at)
--   sales        cabecera de la venta, con folio correlativo
--   sale_items   detalle: un renglón por producto vendido, con copia del
--                nombre, código de barras y precio cobrado en ese momento
-- =============================================================================

--
-- PostgreSQL database dump
--

\restrict LQS9MENjg1wZKXsaeAjO7d3Sx6h0NFigcGGpHmlo68v6GDXOzrk6HBeglbz60f6

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

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

--
-- Name: enum_sales_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_sales_status AS ENUM (
    'completed',
    'cancelled'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    barcode character varying(64) NOT NULL,
    price numeric(10,2) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT products_price_non_negative CHECK ((price >= (0)::numeric))
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id integer NOT NULL,
    sale_id integer NOT NULL,
    product_id integer,
    product_name character varying(150) NOT NULL,
    product_barcode character varying(64) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    line_total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sale_items_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT sale_items_unit_price_non_negative CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: sale_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sale_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sale_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sale_items_id_seq OWNED BY public.sale_items.id;


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id integer NOT NULL,
    folio character varying(20) NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    status public.enum_sales_status DEFAULT 'completed'::public.enum_sales_status NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    sold_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_total_non_negative CHECK ((total >= (0)::numeric))
);


--
-- Name: sales_folio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_folio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_id_seq OWNED BY public.sales.id;


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: sale_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items ALTER COLUMN id SET DEFAULT nextval('public.sale_items_id_seq'::regclass);


--
-- Name: sales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales ALTER COLUMN id SET DEFAULT nextval('public.sales_id_seq'::regclass);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_folio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_folio_key UNIQUE (folio);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: products_barcode_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_barcode_unique ON public.products USING btree (barcode) WHERE (deleted_at IS NULL);


--
-- Name: products_name_lower_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_name_lower_idx ON public.products USING btree (lower((name)::text) varchar_pattern_ops);


--
-- Name: sale_items_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sale_items_product_id_idx ON public.sale_items USING btree (product_id);


--
-- Name: sale_items_sale_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sale_items_sale_id_idx ON public.sale_items USING btree (sale_id);


--
-- Name: sales_sold_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_sold_at_idx ON public.sales USING btree (sold_at);


--
-- Name: sale_items sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict LQS9MENjg1wZKXsaeAjO7d3Sx6h0NFigcGGpHmlo68v6GDXOzrk6HBeglbz60f6

