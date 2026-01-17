-- Enable realtime for metric_value table to receive notifications on data changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.metric_value;